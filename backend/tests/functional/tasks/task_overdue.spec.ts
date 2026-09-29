import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
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

const TODAY = '2026-09-30'

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
  dueDate,
}: {
  title?: string
  status?: TaskStatus
  assigneeId: number
  dueDate?: string
}) {
  return Task.create({
    title,
    status,
    assigneeId,
    ...(dueDate ? { dueDate: DateTime.fromISO(dueDate) } : {}),
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

function expectedDetail(
  task: Task,
  assignee: User,
  createdAt: string,
  {
    dueDate,
    isOverdue,
    status = task.status,
  }: { dueDate: string | null; isOverdue: boolean; status?: TaskStatus }
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

/**
 * What is stored for the task. `updatedAt` catches a write even when no
 * visible value changes.
 */
async function snapshot(id: number) {
  const stored = await Task.findOrFail(id)
  return {
    dueDate: stored.dueDate?.toISODate() ?? null,
    status: stored.status,
    title: stored.title,
    assigneeId: stored.assigneeId,
    updatedAt: stored.updatedAt?.toMillis() ?? null,
  }
}

/**
 * Moves `updated_at` to a fixed instant in the past, so any later write is
 * visible in `snapshot` even if it happens within the same second.
 */
async function backdateUpdatedAt(id: number) {
  await db.from('tasks').where('id', id).update({ updated_at: '2026-01-01 00:00:00' })
}

function getTask(client: ApiClient, id: number) {
  return client.get(`/api/v1/tasks/${id}`)
}

const INVALID_TODAY_ERROR = {
  errors: [{ message: 'The today field must be a datetime value', rule: 'date', field: 'today' }],
}

test.group('Tasks overdue (GET /api/v1/tasks/:id?today=)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('borde «{name}» leído el {today}: vencida = {isOverdue}')
    .with<{ name: string; dueDate?: string; today: string; isOverdue: boolean }[]>([
      { name: 'día anterior', dueDate: '2026-09-29', today: TODAY, isOverdue: true },
      { name: 'día posterior', dueDate: '2026-10-01', today: TODAY, isOverdue: false },
      { name: 'sin fecha', today: TODAY, isOverdue: false },
    ])
    .run(async ({ client, assert }, { dueDate, today, isOverdue }) => {
      const oscar = await createOscar()
      const task = await createTask({ status: 'pending', assigneeId: oscar.id, dueDate })
      const createdAt = await fetchCreatedAt(client, oscar, task.id)

      const response = await getTask(client, task.id).qs({ today }).loginAs(oscar)

      response.assertStatus(200)
      assert.deepEqual(
        response.body(),
        expectedDetail(task, oscar, createdAt, { dueDate: dueDate ?? null, isOverdue })
      )
    })

  test('una tarea creada sin fecha, como las anteriores a la migración, no está vencida', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await Task.create({ title: 'De antes', status: 'pending', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })
    )
  })

  test('una tarea en curso con la fecha pasada también está vencida', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({
      status: 'in_progress',
      assigneeId: oscar.id,
      dueDate: '2026-09-29',
    })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-29', isOverdue: true })
    )
  })

  test('una tarea hecha con la fecha pasada no está vencida y conserva su fecha', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'done', assigneeId: oscar.id, dueDate: '2026-09-01' })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-01', isOverdue: false })
    )
  })

  test('la misma tarea, leída con dos días de referencia distintos, da dos lecturas correctas', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask({
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-29',
    })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const fromMadrid = await getTask(client, task.id).qs({ today: '2026-09-30' }).loginAs(oscar)
    const fromMexico = await getTask(client, task.id).qs({ today: '2026-09-28' }).loginAs(ana)

    fromMadrid.assertStatus(200)
    fromMexico.assertStatus(200)
    assert.deepEqual(
      fromMadrid.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-29', isOverdue: true })
    )
    assert.deepEqual(
      fromMexico.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-29', isOverdue: false })
    )
  })

  test('al pasar la medianoche vence sola, sin que nadie toque la tarea', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-30',
    })
    await backdateUpdatedAt(task.id)
    const createdAt = await fetchCreatedAt(client, oscar, task.id)
    const before = await snapshot(task.id)

    const onTheDay = await getTask(client, task.id).qs({ today: '2026-09-29' }).loginAs(oscar)
    const between = await snapshot(task.id)
    const nextDay = await getTask(client, task.id).qs({ today: '2026-10-01' }).loginAs(oscar)

    onTheDay.assertStatus(200)
    nextDay.assertStatus(200)
    assert.deepEqual(
      onTheDay.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-30', isOverdue: false })
    )
    assert.deepEqual(
      nextDay.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-30', isOverdue: true })
    )
    assert.deepEqual(between, before)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('quitar la fecha de una tarea vencida deja de vencer, al guardar y al volver a leer', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-29',
    })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)
    const expected = expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })

    const saved = await client
      .put(`/api/v1/tasks/${task.id}/due-date`)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: null })
    const read = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    saved.assertStatus(200)
    read.assertStatus(200)
    assert.deepEqual(saved.body(), expected)
    assert.deepEqual(read.body(), expected)
  })

  test('pasar una tarea vencida a «Hecho» conserva la fecha y deja de vencer', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-29',
    })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const changed = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done' })
    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    changed.assertStatus(200)
    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, {
        status: 'done',
        dueDate: '2026-09-29',
        isOverdue: false,
      })
    )
  })

  test('sacar de «Hecho» una tarea con la fecha pasada vuelve a vencer', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'done', assigneeId: oscar.id, dueDate: '2026-09-29' })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const changed = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'pending' })
    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    changed.assertStatus(200)
    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, {
        status: 'pending',
        dueDate: '2026-09-29',
        isOverdue: true,
      })
    )
  })

  test('sin día de referencia, usa la fecha UTC del servidor: {name}')
    .with([
      { name: 'dos días antes, vencida', days: -2, isOverdue: true },
      { name: 'dos días después, no vencida', days: 2, isOverdue: false },
    ])
    .run(async ({ client, assert }, { days, isOverdue }) => {
      const oscar = await createOscar()
      const dueDate = DateTime.utc().plus({ days }).toISODate()
      const task = await createTask({ status: 'pending', assigneeId: oscar.id, dueDate })
      const createdAt = await fetchCreatedAt(client, oscar, task.id)

      const response = await getTask(client, task.id).loginAs(oscar)

      response.assertStatus(200)
      assert.deepEqual(
        response.body(),
        expectedDetail(task, oscar, createdAt, { dueDate, isOverdue })
      )
    })

  test('rechaza un día de referencia inexistente o mal formado ({today})')
    .with([{ today: '2026-02-31' }, { today: '30/09/2026' }])
    .run(async ({ client, assert }, { today }) => {
      const oscar = await createOscar()
      const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-09-29' })

      const response = await getTask(client, task.id).qs({ today }).loginAs(oscar)

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_TODAY_ERROR)
    })

  test('crear una tarea no le pone fecha', async ({ client, assert }) => {
    const oscar = await createOscar()

    const created = await client.post('/api/v1/tasks').loginAs(oscar).json({ title: 'Nueva' })
    created.assertStatus(201)
    const task = await Task.findOrFail((created.body().data as TaskResponseBody).id)
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })
    )
  })

  test('crear una tarea ignora una fecha enviada en el cuerpo', async ({ client, assert }) => {
    const oscar = await createOscar()
    const body = { title: 'Nueva', dueDate: '2026-09-01' }

    const created = await client.post('/api/v1/tasks').loginAs(oscar).json(body)
    created.assertStatus(201)
    const task = await Task.findOrFail((created.body().data as TaskResponseBody).id)
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await getTask(client, task.id).qs({ today: TODAY }).loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })
    )
  })

  test('la lista no lleva la fecha ni si está vencida, tenga fecha o no', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    await createTask({ title: 'Sin fecha', assigneeId: oscar.id })
    await createTask({ title: 'Futura', assigneeId: oscar.id, dueDate: '2026-10-15' })
    await createTask({
      title: 'Vencida',
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-01',
    })

    const response = await client.get('/api/v1/tasks').loginAs(oscar)

    response.assertStatus(200)
    const items = response.body().data as Record<string, unknown>[]
    assert.lengthOf(items, 3)
    for (const item of items) {
      assert.deepEqual(Object.keys(item).sort(), ['assignee', 'createdAt', 'id', 'status', 'title'])
    }
  })

  test('poner una fecha no cambia la fila de la tarea en la lista', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const before = await fetchListed(client, oscar, task.id)

    const saved = await client
      .put(`/api/v1/tasks/${task.id}/due-date`)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })
    const after = await fetchListed(client, oscar, task.id)

    saved.assertStatus(200)
    assert.deepEqual(after, before)
  })
})
