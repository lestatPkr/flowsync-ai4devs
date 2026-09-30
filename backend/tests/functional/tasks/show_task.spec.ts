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

function createTask({
  title = 'Revisar el PR de auth',
  status = 'pending',
  assigneeId,
  dueDate = null,
}: {
  title?: string
  status?: TaskStatus
  assigneeId: number
  dueDate?: string | null
}) {
  return Task.create({
    title,
    status,
    assigneeId,
    dueDate: dueDate ? DateTime.fromISO(dueDate) : null,
  })
}

/**
 * The row of a task as `GET /api/v1/tasks` returns it, so the test does not
 * depend on how Luxon serializes dates.
 */
async function fetchListed(client: ApiClient, viewer: User, id: number) {
  const response = await client.get('/api/v1/tasks').loginAs(viewer)
  return (response.body().data as TaskResponseBody[]).find((item) => item.id === id)!
}

async function fetchCreatedAt(client: ApiClient, viewer: User, id: number) {
  const listed = await fetchListed(client, viewer, id)
  return listed.createdAt
}

/**
 * FS-118 adds `dueDate` and `isOverdue` to the detail (and only to the detail):
 * a task without a due date is never overdue.
 */
function expectedBody(
  task: Task,
  assignee: User,
  createdAt: string,
  { dueDate = null, isOverdue = false }: { dueDate?: string | null; isOverdue?: boolean } = {}
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

  test('el detalle es la fila de la lista más dueDate e isOverdue, que la fila no lleva', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    await createTask({ title: 'Otra', assigneeId: oscar.id })
    const task = await createTask({ status: 'in_progress', assigneeId: ana.id })

    const listed = await fetchListed(client, oscar, task.id)
    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, { ...listed, dueDate: null, isOverdue: false })
    assert.notProperty(listed, 'dueDate')
    assert.notProperty(listed, 'isOverdue')
  })

  test('CA-2: al abrir una tarea con fecha se ve su fecha', async ({ client, assert }) => {
    const oscar = await createOscar()
    // Far enough in the future to never be overdue, whatever the real date.
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2999-10-15' })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, createdAt, { dueDate: '2999-10-15', isOverdue: false })
    )
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
