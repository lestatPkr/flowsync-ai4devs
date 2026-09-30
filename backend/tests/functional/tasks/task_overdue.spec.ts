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

function createTask(
  assignee: User,
  status: TaskStatus,
  dueDate: string | null,
  { createdAt }: { createdAt?: DateTime } = {}
) {
  return Task.create({
    title: 'Revisar el PR de auth',
    status,
    assigneeId: assignee.id,
    dueDate: dueDate ? DateTime.fromISO(dueDate) : null,
    ...(createdAt ? { createdAt } : {}),
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
  status: TaskStatus,
  { dueDate, isOverdue }: { dueDate: string | null; isOverdue: boolean },
  createdAt: string
) {
  return {
    data: {
      id: task.id,
      title: task.title,
      status,
      assignee: { id: assignee.id, fullName: assignee.fullName, initials: assignee.initials },
      createdAt,
      dueDate,
      isOverdue,
    },
  }
}

function openTask(client: ApiClient, viewer: User, task: Task | number, today?: string) {
  const id = typeof task === 'number' ? task : task.id
  const request = client.get(`/api/v1/tasks/${id}`).loginAs(viewer)
  return today ? request.qs({ today }) : request
}

async function readUpdatedAt(task: Task) {
  const stored = await Task.findOrFail(task.id)
  return stored.updatedAt?.toMillis() ?? null
}

const INVALID_TODAY_ERROR = {
  errors: [{ message: 'The today field must be a datetime value', rule: 'date', field: 'today' }],
}

const TODAY = '2026-09-30'

test.group('Tasks overdue rule (GET /api/v1/tasks/:id?today=)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('CA-4: con la fecha del día anterior, la tarea está vencida', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-29', isOverdue: true }, createdAt)
    )
  })

  test('CA-5: con la fecha del mismo día, la tarea todavía no está vencida', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-30')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-30', isOverdue: false }, createdAt)
    )
  })

  test('CA-6: con la fecha del día posterior, la tarea no está vencida', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-10-01')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-10-01', isOverdue: false }, createdAt)
    )
  })

  test('CA-7: sin fecha no se vence nunca, por antigua que sea la tarea', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', null, {
      createdAt: DateTime.fromISO('2026-08-01T09:00:00'),
    })
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'pending', { dueDate: null, isOverdue: false }, createdAt)
    )
  })

  test('CA-9: una tarea hecha con la fecha pasada no está vencida y conserva la fecha', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'done', '2026-09-01')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'done', { dueDate: '2026-09-01', isOverdue: false }, createdAt)
    )
  })

  test('RF-14: una tarea en curso con la fecha pasada está vencida', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'in_progress', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(
        task,
        oscar,
        'in_progress',
        { dueDate: '2026-09-29', isOverdue: true },
        createdAt
      )
    )
  })

  test('CA-19: dos husos ven la misma tarea una vencida y otra no, ambas correctamente', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const stillYesterday = await openTask(client, oscar, task, '2026-09-29')
    const alreadyToday = await openTask(client, oscar, task, '2026-09-30')

    stillYesterday.assertStatus(200)
    alreadyToday.assertStatus(200)
    assert.deepEqual(
      stillYesterday.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-29', isOverdue: false }, createdAt)
    )
    assert.deepEqual(
      alreadyToday.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-29', isOverdue: true }, createdAt)
    )
  })

  test('CA-20: una tarea vence sola al pasar la medianoche, sin que nadie la toque', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-30')
    const createdAt = await fetchCreatedAt(client, oscar, task)
    const updatedAtBefore = await readUpdatedAt(task)

    const beforeMidnight = await openTask(client, oscar, task, '2026-09-30')
    const afterMidnight = await openTask(client, oscar, task, '2026-10-01')

    assert.deepEqual(
      beforeMidnight.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-30', isOverdue: false }, createdAt)
    )
    assert.deepEqual(
      afterMidnight.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-30', isOverdue: true }, createdAt)
    )
    assert.equal(await readUpdatedAt(task), updatedAtBefore)
  })

  test('sin today, el vencimiento se calcula con la fecha UTC del servidor', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const yesterdayUtc = DateTime.utc().minus({ days: 1 }).toISODate()!
    const task = await createTask(oscar, 'pending', yesterdayUtc)
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const response = await openTask(client, oscar, task)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'pending', { dueDate: yesterdayUtc, isOverdue: true }, createdAt)
    )
  })

  test('un today vacío no es un today ausente: se rechaza como mal formado', async ({
    client,
    assert,
  }) => {
    // Literal `?today=` in the URL: the api client's `.qs()` drops empty values.
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-29')

    const response = await client.get(`/api/v1/tasks/${task.id}?today=`).loginAs(oscar)

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_TODAY_ERROR)
  })

  test('volver de «Hecho» con la fecha pasada la vuelve a vencer', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'done', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const reopened = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'pending' })
    reopened.assertStatus(200)
    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'pending', { dueDate: '2026-09-29', isOverdue: true }, createdAt)
    )
  })

  test('CA-8: pasar a «Hecho» una tarea vencida la deja de vencer sin tocar la fecha', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask(oscar, 'pending', '2026-09-29')
    const createdAt = await fetchCreatedAt(client, oscar, task)

    const done = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done' })
    done.assertStatus(200)
    const response = await openTask(client, oscar, task, TODAY)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedBody(task, oscar, 'done', { dueDate: '2026-09-29', isOverdue: false }, createdAt)
    )
  })

  test('rechaza un today que no es una fecha real ({today})')
    .with([{ today: '2026-02-31' }, { today: '30/09/2026' }])
    .run(async ({ client, assert }, { today }) => {
      const oscar = await createOscar()
      const task = await createTask(oscar, 'pending', '2026-09-29')

      const response = await openTask(client, oscar, task, today)

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_TODAY_ERROR)
    })
})
