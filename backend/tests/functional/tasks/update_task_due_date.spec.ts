import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
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

function createTask(
  assignee: User,
  status: TaskStatus,
  dueDate: string | null = null,
  title = 'Revisar el PR de auth'
) {
  return Task.create({
    title,
    status,
    assigneeId: assignee.id,
    dueDate: dueDate ? DateTime.fromISO(dueDate) : null,
  })
}

/**
 * The `createdAt` is taken from the API itself (GET /api/v1/tasks), so the
 * test does not depend on how Luxon serializes dates.
 */
async function fetchCreatedAt(client: ApiClient, viewer: User, task: Task) {
  const response = await client.get('/api/v1/tasks').loginAs(viewer)
  const listed = (response.body().data as TaskResponseBody[]).find((item) => item.id === task.id)
  return listed!.createdAt
}

function expectedBody(
  task: Task,
  assignee: User,
  { dueDate, isOverdue }: { dueDate: string | null; isOverdue: boolean },
  createdAt: string
) {
  return {
    data: {
      id: task.id,
      title: task.title,
      status: task.status,
      assignee: { id: assignee.id, fullName: assignee.fullName, initials: assignee.initials },
      createdAt,
      dueDate,
      isOverdue,
    },
  }
}

async function readFromDb(task: Task) {
  const stored = await Task.findOrFail(task.id)
  return {
    dueDate: stored.dueDate?.toISODate() ?? null,
    status: stored.status,
    title: stored.title,
    assigneeId: stored.assigneeId,
  }
}

async function readDueDate(task: Task) {
  const stored = await readFromDb(task)
  return stored.dueDate
}

function putDueDate(client: ApiClient, id: number | string, body: object, today?: string) {
  const request = client.put(`/api/v1/tasks/${id}/due-date`).json(body)
  return today ? request.qs({ today }) : request
}

const INVALID_DUE_DATE_ERROR = {
  errors: [
    { message: 'The dueDate field must be a datetime value', rule: 'date', field: 'dueDate' },
  ],
}

const REQUIRED_DUE_DATE_ERROR = {
  errors: [{ message: 'The dueDate field must be defined', rule: 'required', field: 'dueDate' }],
}

const INVALID_TODAY_ERROR = {
  errors: [{ message: 'The today field must be a datetime value', rule: 'date', field: 'today' }],
}

const UNAUTHORIZED_ERROR = { errors: [{ message: 'Unauthorized access' }] }

const NOT_FOUND_ERROR = { errors: [{ message: 'Row not found' }] }

const TODAY = '2026-09-30'

test.group('Tasks due date update (PUT /api/v1/tasks/:id/due-date)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('CA-2: pone una fecha a una tarea sin fecha y no toca otras', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    const witness = await createTask(oscar, 'pending', null, 'Testigo')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-10-15' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-10-15', isOverdue: false }, createdAt)
    )
    assert.deepEqual(await readFromDb(task), {
      dueDate: '2026-10-15',
      status: 'pending',
      title: task.title,
      assigneeId: oscar.id,
    })
    assert.deepEqual(await readFromDb(witness), {
      dueDate: null,
      status: 'pending',
      title: 'Testigo',
      assigneeId: oscar.id,
    })
  })

  test('CA-2: cambia la fecha por otra', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-11-01' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-11-01', isOverdue: false }, createdAt)
    )
    assert.equal(await readDueDate(task), '2026-11-01')
  })

  test('CA-3: quita la fecha con null', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: null }, TODAY).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: null, isOverdue: false }, createdAt)
    )
    assert.isNull(await readDueDate(task))
  })

  test('CA-3: quitar la fecha de una tarea vencida la deja de vencer en esa misma respuesta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: null }, TODAY).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: null, isOverdue: false }, createdAt)
    )
  })

  test('CA-3: quitar la fecha de una tarea sin fecha no es un error', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: null }, TODAY).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: null, isOverdue: false }, createdAt)
    )
    assert.isNull(await readDueDate(task))
  })

  test('CA-13: acepta una fecha pasada y la tarea pasa a vencida', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-09-01' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-09-01', isOverdue: true }, createdAt)
    )
    assert.equal(await readDueDate(task), '2026-09-01')
  })

  test('CA-10: aplazar la fecha a una posterior a hoy resuelve el vencimiento', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-10-05' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-10-05', isOverdue: false }, createdAt)
    )
  })

  test('CA-17: cualquiera pone la fecha de una tarea ajena, sin campos extra', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask(ana, 'in_progress')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-10-15' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, ana, { dueDate: '2026-10-15', isOverdue: false }, createdAt)
    )
    assert.deepEqual(await readFromDb(task), {
      dueDate: '2026-10-15',
      status: 'in_progress',
      title: task.title,
      assigneeId: ana.id,
    })
  })

  test('solo guarda la fecha aunque el cuerpo traiga título, estado o responsable', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask(oscar, 'in_progress')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(
      client,
      task.id,
      { dueDate: '2026-10-15', title: 'Otro título', status: 'done', assigneeId: ana.id },
      TODAY
    ).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-10-15', isOverdue: false }, createdAt)
    )
    assert.deepEqual(await readFromDb(task), {
      dueDate: '2026-10-15',
      status: 'in_progress',
      title: task.title,
      assigneeId: oscar.id,
    })
  })

  test('CA-9: una tarea hecha con la fecha pasada no está vencida', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'done')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-09-01' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-09-01', isOverdue: false }, createdAt)
    )
  })

  test('CA-19: la misma fecha se lee según el today de cada petición', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const sameDay = await putDueDate(client, task.id, { dueDate: '2026-09-30' }, TODAY).loginAs(
      oscar
    )
    const nextDay = await putDueDate(
      client,
      task.id,
      { dueDate: '2026-09-30' },
      '2026-10-01'
    ).loginAs(oscar)

    sameDay.assertStatus(200)
    nextDay.assertStatus(200)
    assert.deepEqual(
      sameDay.body(),
      expectedBody(task, oscar, { dueDate: '2026-09-30', isOverdue: false }, createdAt)
    )
    assert.deepEqual(
      nextDay.body(),
      expectedBody(task, oscar, { dueDate: '2026-09-30', isOverdue: true }, createdAt)
    )
  })

  test('poner la misma fecha que ya tenía no es un error y deja la tarea igual', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '2026-10-15' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: '2026-10-15', isOverdue: false }, createdAt)
    )
    assert.equal(await readDueDate(task), '2026-10-15')
  })

  test('FR-005: un dueDate vacío equivale a quitar la fecha, sin error', async ({
    client,
    assert,
  }) => {
    // The bodyparser turns empty strings into null (convertEmptyStringsToNull).
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await putDueDate(client, task.id, { dueDate: '' }, TODAY).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: null, isOverdue: false }, createdAt)
    )
    assert.isNull(await readDueDate(task))
  })

  test('sin today, el vencimiento se calcula con la fecha UTC del servidor', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    const createdAt = await fetchCreatedAt(client, oscar, task)
    const yesterdayUtc = DateTime.utc().minus({ days: 1 }).toISODate()!

    const response = await putDueDate(client, task.id, { dueDate: yesterdayUtc }).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, { dueDate: yesterdayUtc, isOverdue: true }, createdAt)
    )
  })

  test('CA-14: rechaza una fecha imposible {dueDate} y conserva la anterior')
    .with([
      { dueDate: '2026-02-31' },
      { dueDate: '30/09/2026' },
      { dueDate: 'mañana' },
      { dueDate: '2026-09-30T10:00:00Z' },
    ])
    .run(async ({ client, assert }, { dueDate }) => {
      const oscar = await createOscar()
      const task = await createTask(oscar, 'pending', '2026-10-15')

      const response = await putDueDate(client, task.id, { dueDate }, TODAY).loginAs(oscar)

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_DUE_DATE_ERROR)
      assert.deepEqual(await readFromDb(task), {
        dueDate: '2026-10-15',
        status: 'pending',
        title: task.title,
        assigneeId: oscar.id,
      })
    })

  test('CA-14: una tarea sin fecha sigue sin fecha tras una fecha rechazada', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')

    const response = await putDueDate(client, task.id, { dueDate: 'mañana' }, TODAY).loginAs(oscar)

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_DUE_DATE_ERROR)
    assert.isNull(await readDueDate(task))
  })

  test('rechaza un cuerpo sin dueDate y conserva la fecha', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')

    const response = await putDueDate(client, task.id, {}, TODAY).loginAs(oscar)

    response.assertStatus(422)
    assert.deepEqual(response.body(), REQUIRED_DUE_DATE_ERROR)
    assert.equal(await readDueDate(task), '2026-10-15')
  })

  test('rechaza un today mal formado y no guarda la fecha', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')

    const response = await putDueDate(
      client,
      task.id,
      { dueDate: '2026-10-15' },
      '30-09-2026'
    ).loginAs(oscar)

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_TODAY_ERROR)
    assert.isNull(await readDueDate(task))
  })

  test('sin sesión iniciada no cambia la fecha', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')

    const response = await putDueDate(client, task.id, { dueDate: null }, TODAY)

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    assert.equal(await readDueDate(task), '2026-10-15')
  })

  test('con un token que no es válido no cambia la fecha', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-15')

    const response = await putDueDate(client, task.id, { dueDate: null }, TODAY).header(
      'Authorization',
      'Bearer oat_no-es-un-token'
    )

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    assert.equal(await readDueDate(task), '2026-10-15')
  })

  test('avisa de que la tarea no existe si el id nunca existió', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await putDueDate(client, 999999, { dueDate: '2026-10-15' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('avisa de que la tarea no existe si se borró', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending')
    await task.delete()

    const response = await putDueDate(client, task.id, { dueDate: '2026-10-15' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('trata un id no numérico como tarea inexistente', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await putDueDate(client, 'abc', { dueDate: '2026-10-15' }, TODAY).loginAs(
      oscar
    )

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })
})
