import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Task, { type TaskStatus } from '#models/task'

type TaskResponseBody = {
  id: number
  title: string
  status: string
  assignee: { id: number; fullName: string | null; initials: string }
  createdAt: string
}

function createOscar() {
  return User.create({
    fullName: 'Oscar Torres',
    email: 'oscar@example.com',
    password: 'password123',
  })
}

function createAna() {
  return User.create({
    fullName: 'Ana Ruiz',
    email: 'ana@example.com',
    password: 'password123',
  })
}

function createTask(assignee: User, status: TaskStatus, title = 'Revisar el PR de auth') {
  return Task.create({ title, status, assigneeId: assignee.id })
}

/**
 * The `createdAt` is taken from the API itself (the list, before the change),
 * so the test does not depend on how Luxon serializes dates. It looks in both
 * views of the list (the default one and «Hecho»), which together hold every
 * task of the space.
 */
async function fetchCreatedAt(client: ApiClient, viewer: User, task: Task) {
  const live = await client.get('/api/v1/tasks').loginAs(viewer)
  const done = await client.get('/api/v1/tasks?status=done').loginAs(viewer)
  const rows = [
    ...(live.body().data as TaskResponseBody[]),
    ...(done.body().data as TaskResponseBody[]),
  ]
  const listed = rows.find((item) => item.id === task.id)
  return listed!.createdAt
}

function expectedBody(
  task: Task,
  assignee: User,
  status: TaskStatus,
  createdAt: string,
  title = task.title
) {
  return {
    data: {
      id: task.id,
      title,
      status,
      assignee: { id: assignee.id, fullName: assignee.fullName, initials: assignee.initials },
      createdAt,
    },
  }
}

async function readFromDb(task: Task) {
  const stored = await Task.findOrFail(task.id)
  return { status: stored.status, title: stored.title, assigneeId: stored.assigneeId }
}

const INVALID_STATUS_ERROR = {
  errors: [
    {
      message: 'The selected status is invalid',
      rule: 'enum',
      field: 'status',
      meta: { choices: ['pending', 'in_progress', 'done'] },
    },
  ],
}

const MISSING_STATUS_ERROR = {
  errors: [{ message: 'The status field must be defined', rule: 'required', field: 'status' }],
}

const NOT_FOUND_ERROR = { errors: [{ message: 'Row not found' }] }

test.group('Tasks status update (PATCH /api/v1/tasks/:id/status)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('cambia el estado de {from} a {to}')
    .with<{ from: TaskStatus; to: TaskStatus }[]>([
      { from: 'pending', to: 'in_progress' },
      { from: 'pending', to: 'done' },
      { from: 'in_progress', to: 'pending' },
      { from: 'in_progress', to: 'done' },
      { from: 'done', to: 'pending' },
      { from: 'done', to: 'in_progress' },
    ])
    .run(async ({ client, assert }, { from, to }) => {
      const oscar = await createOscar()
      const task = await createTask(oscar, from)
      const witness = await createTask(oscar, from, 'Testigo')
      const createdAt = await fetchCreatedAt(client, oscar, task)

      const response = await client
        .patch(`/api/v1/tasks/${task.id}/status`)
        .loginAs(oscar)
        .json({ status: to })

      response.assertStatus(200)
      assert.deepEqual(response.body(), expectedBody(task, oscar, to, createdAt))
      assert.deepEqual(await readFromDb(task), {
        status: to,
        title: task.title,
        assigneeId: oscar.id,
      })
      assert.deepEqual(await readFromDb(witness), {
        status: from,
        title: 'Testigo',
        assigneeId: oscar.id,
      })
    })

  test('elegir el mismo estado que ya tiene no es un error', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'done')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done' })

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, oscar, 'done', createdAt))
    assert.deepEqual(await readFromDb(task), {
      status: 'done',
      title: task.title,
      assigneeId: oscar.id,
    })
  })

  test('cambia el estado de una tarea ajena sin tocar su responsable', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask(ana, 'pending')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done' })

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, ana, 'done', createdAt))
    assert.deepEqual(await readFromDb(task), {
      status: 'done',
      title: task.title,
      assigneeId: ana.id,
    })
  })

  test('ignora cualquier otra clave del cuerpo: solo cambia el estado', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask(oscar, 'pending', 'Original')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done', title: 'Hackeado', assigneeId: ana.id })

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, oscar, 'done', createdAt, 'Original'))
    assert.deepEqual(await readFromDb(task), {
      status: 'done',
      title: 'Original',
      assigneeId: oscar.id,
    })
  })

  test('rechaza un estado fuera del catálogo ({status}) y la tarea no cambia')
    .with([{ status: 'archived' }, { status: 'Hecho' }, { status: 'DONE' }])
    .run(async ({ client, assert }, { status }) => {
      const oscar = await createOscar()
      const task = await createTask(oscar, 'pending')

      const response = await client
        .patch(`/api/v1/tasks/${task.id}/status`)
        .loginAs(oscar)
        .json({ status })

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_STATUS_ERROR)
      assert.deepEqual(await readFromDb(task), {
        status: 'pending',
        title: task.title,
        assigneeId: oscar.id,
      })
    })

  test('rechaza un estado ausente, nulo o vacío ({$i}) y la tarea no cambia')
    .with<Record<string, string | null>[]>([{}, { status: null }, { status: '' }])
    .run(async ({ client, assert }, body) => {
      const oscar = await createOscar()
      const task = await createTask(oscar, 'pending')

      const response = await client
        .patch(`/api/v1/tasks/${task.id}/status`)
        .loginAs(oscar)
        .json(body)

      response.assertStatus(422)
      assert.deepEqual(response.body(), MISSING_STATUS_ERROR)
      assert.deepEqual(await readFromDb(task), {
        status: 'pending',
        title: task.title,
        assigneeId: oscar.id,
      })
    })

  test('valida el cuerpo antes de buscar la tarea: inválido sobre id inexistente es 422', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()

    const response = await client
      .patch('/api/v1/tasks/999999/status')
      .loginAs(oscar)
      .json({ status: 'archived' })

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_STATUS_ERROR)
  })

  test('sin sesión iniciada, el cambio se rechaza y la tarea no cambia', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')

    const response = await client.patch(`/api/v1/tasks/${task.id}/status`).json({ status: 'done' })

    response.assertStatus(401)
    assert.deepEqual(response.body(), { errors: [{ message: 'Unauthorized access' }] })
    assert.deepEqual(await readFromDb(task), {
      status: 'pending',
      title: task.title,
      assigneeId: oscar.id,
    })
  })

  test('avisa de que la tarea no existe si el id nunca existió', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await client
      .patch('/api/v1/tasks/999999/status')
      .loginAs(oscar)
      .json({ status: 'done' })

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('avisa de que la tarea no existe si se borró y no crea ninguna', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    await task.delete()

    const response = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done' })

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
    assert.lengthOf(await Task.query(), 0)
  })

  test('trata un id no numérico como tarea inexistente', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await client
      .patch('/api/v1/tasks/abc/status')
      .loginAs(oscar)
      .json({ status: 'done' })

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })
})
