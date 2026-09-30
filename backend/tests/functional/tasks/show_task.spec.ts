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

function createTask({
  title = 'Revisar el PR de auth',
  status = 'pending',
  assigneeId,
}: {
  title?: string
  status?: TaskStatus
  assigneeId: number
}) {
  return Task.create({ title, status, assigneeId })
}

/**
 * The row of a task as the list returns it, so the test does not depend on
 * how Luxon serializes dates. It looks in both views of the list (the default
 * one and «Hecho»), which together hold every task of the space.
 */
async function fetchListed(client: ApiClient, viewer: User, id: number) {
  const live = await client.get('/api/v1/tasks').loginAs(viewer)
  const done = await client.get('/api/v1/tasks?status=done').loginAs(viewer)
  const rows = [
    ...(live.body().data as TaskResponseBody[]),
    ...(done.body().data as TaskResponseBody[]),
  ]
  return rows.find((item) => item.id === id)!
}

async function fetchCreatedAt(client: ApiClient, viewer: User, id: number) {
  const listed = await fetchListed(client, viewer, id)
  return listed.createdAt
}

function expectedBody(task: Task, assignee: User, createdAt: string) {
  return {
    data: {
      id: task.id,
      title: task.title,
      status: task.status,
      assignee: { id: assignee.id, fullName: assignee.fullName, initials: assignee.initials },
      createdAt,
      dueDate: null,
      isOverdue: false,
    },
  }
}

/**
 * What must not move when a task is only read. `updatedAt` catches an
 * accidental write even if no visible value changes.
 */
async function snapshot(id: number) {
  const stored = await Task.findOrFail(id)
  return {
    status: stored.status,
    title: stored.title,
    assigneeId: stored.assigneeId,
    updatedAt: stored.updatedAt?.toMillis() ?? null,
  }
}

const UNAUTHORIZED_ERROR = { errors: [{ message: 'Unauthorized access' }] }

const NOT_FOUND_ERROR = { errors: [{ message: 'Row not found' }] }

test.group('Tasks show (GET /api/v1/tasks/:id)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('abre una tarea propia y no cambia nada en ella', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'pending', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)
    const before = await snapshot(task.id)

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, oscar, createdAt))
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('entre varias tareas, devuelve la pedida y no otra', async ({ client, assert }) => {
    const oscar = await createOscar()
    await createTask({ title: 'Primera', assigneeId: oscar.id })
    const middle = await createTask({ title: 'Segunda', assigneeId: oscar.id })
    await createTask({ title: 'Tercera', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, middle.id)

    const response = await client.get(`/api/v1/tasks/${middle.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(middle, oscar, createdAt))
  })

  test('abre una tarea ajena igual que una propia y no cambia nada en ella', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask({ status: 'in_progress', assigneeId: ana.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)
    const before = await snapshot(task.id)

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, ana, createdAt))
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('el detalle coincide con la fila de esa tarea en la lista', async ({ client, assert }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    await createTask({ title: 'Otra', assigneeId: oscar.id })
    const task = await createTask({ status: 'in_progress', assigneeId: ana.id })

    const listed = await fetchListed(client, oscar, task.id)
    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, { ...listed, dueDate: null, isOverdue: false })
  })

  test('abre una tarea en «Hecho» como cualquier otra', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'done', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, oscar, createdAt))
    assert.equal(response.body().data.status, 'done')
  })

  test('devuelve el título entero aunque tenga 200 caracteres', async ({ client, assert }) => {
    const oscar = await createOscar()
    const title = 'a'.repeat(199) + 'z'
    const task = await createTask({ title, assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), expectedBody(task, oscar, createdAt))
    assert.lengthOf(response.body().data.title, 200)
  })

  test('sin sesión iniciada no devuelve nada de la tarea ni la cambia', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const before = await snapshot(task.id)

    const response = await client.get(`/api/v1/tasks/${task.id}`)

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('con un token que no es válido no devuelve nada de la tarea', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client
      .get(`/api/v1/tasks/${task.id}`)
      .header('Authorization', 'Bearer oat_no-es-un-token')

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
  })

  test('avisa de que la tarea no existe si el id nunca existió', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await client.get('/api/v1/tasks/999999').loginAs(oscar)

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('avisa de que la tarea no existe si se borró', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    await task.delete()

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('trata un id no numérico como tarea inexistente', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await client.get('/api/v1/tasks/abc').loginAs(oscar)

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })
})
