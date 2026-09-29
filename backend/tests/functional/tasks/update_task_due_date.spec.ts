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
 * The `createdAt` is taken from the API itself (the row of the task in
 * GET /api/v1/tasks), so the test does not depend on how Luxon serializes dates.
 */
async function fetchCreatedAt(client: ApiClient, viewer: User, id: number) {
  const response = await client.get('/api/v1/tasks').loginAs(viewer)
  const listed = (response.body().data as TaskResponseBody[]).find((item) => item.id === id)
  return listed!.createdAt
}

function expectedDetail(
  task: Task,
  assignee: User,
  createdAt: string,
  { dueDate, isOverdue }: { dueDate: string | null; isOverdue: boolean }
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

function putDueDate(client: ApiClient, id: number | string) {
  return client.put(`/api/v1/tasks/${id}/due-date`)
}

const INVALID_DATE_ERROR = {
  errors: [
    { message: 'The dueDate field must be a datetime value', rule: 'date', field: 'dueDate' },
  ],
}

const INVALID_TODAY_ERROR = {
  errors: [{ message: 'The today field must be a datetime value', rule: 'date', field: 'today' }],
}

const MISSING_DATE_ERROR = {
  errors: [{ message: 'The dueDate field must be defined', rule: 'required', field: 'dueDate' }],
}

const OUT_OF_RANGE_ERROR = {
  errors: [
    {
      message: 'The dueDate field must be a date after or equal to 1000-01-01',
      rule: 'date.afterOrEqual',
      field: 'dueDate',
      meta: { expectedValue: '1000-01-01', compare: 'day' },
    },
  ],
}

const UNAUTHORIZED_ERROR = { errors: [{ message: 'Unauthorized access' }] }

const NOT_FOUND_ERROR = { errors: [{ message: 'Row not found' }] }

test.group('Tasks due date (PUT /api/v1/tasks/:id/due-date)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('pone una fecha a una tarea que no tenía y no toca nada más', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'pending', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-10-15', isOverdue: false })
    )
    const stored = await snapshot(task.id)
    assert.deepEqual(
      { dueDate: stored.dueDate, status: stored.status, title: stored.title },
      { dueDate: '2026-10-15', status: 'pending', title: task.title }
    )
    assert.equal(stored.assigneeId, oscar.id)
  })

  test('cambia la fecha que ya tenía', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-11-01' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-11-01', isOverdue: false })
    )
    const stored = await snapshot(task.id)
    assert.equal(stored.dueDate, '2026-11-01')
  })

  test('quita la fecha con null', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: null })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })
    )
    const stored = await snapshot(task.id)
    assert.isNull(stored.dueDate)
  })

  test('acepta una fecha pasada sin aviso y la respuesta ya dice que está vencida', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'pending', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-09-01' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-09-01', isOverdue: true })
    )
  })

  test('quitar la fecha de una tarea vencida deja de vencer en la misma respuesta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-01',
    })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: null })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })
    )
  })

  test('aplazar la fecha de una tarea vencida deja de vencer en la misma respuesta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: '2026-09-01',
    })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-10-15', isOverdue: false })
    )
  })

  test('pone la fecha de una tarea ajena igual que la de una propia', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask({ assigneeId: ana.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, ana, createdAt, { dueDate: '2026-10-15', isOverdue: false })
    )
    const stored = await snapshot(task.id)
    assert.equal(stored.assigneeId, ana.id)
  })

  test('ignora cualquier otra clave del cuerpo: solo escribe la fecha', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask({ title: 'Original', status: 'pending', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const body = { dueDate: '2026-10-15', status: 'done', title: 'x', assigneeId: ana.id }

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json(body)

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-10-15', isOverdue: false })
    )
    const stored = await snapshot(task.id)
    assert.deepEqual(
      {
        dueDate: stored.dueDate,
        status: stored.status,
        title: stored.title,
        assigneeId: stored.assigneeId,
      },
      { dueDate: '2026-10-15', status: 'pending', title: 'Original', assigneeId: oscar.id }
    )
  })

  test('poner la misma fecha que ya tenía responde igual y no escribe', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    await backdateUpdatedAt(task.id)
    const createdAt = await fetchCreatedAt(client, oscar, task.id)
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: '2026-10-15', isOverdue: false })
    )
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('acepta los extremos del rango ({dueDate})')
    .with([
      { dueDate: '1000-01-01', isOverdue: true },
      { dueDate: '9999-12-31', isOverdue: false },
    ])
    .run(async ({ client, assert }, { dueDate, isOverdue }) => {
      const oscar = await createOscar()
      const task = await createTask({ status: 'pending', assigneeId: oscar.id })
      const createdAt = await fetchCreatedAt(client, oscar, task.id)

      const response = await putDueDate(client, task.id)
        .qs({ today: TODAY })
        .loginAs(oscar)
        .json({ dueDate })

      response.assertStatus(200)
      assert.deepEqual(
        response.body(),
        expectedDetail(task, oscar, createdAt, { dueDate, isOverdue })
      )
      const stored = await snapshot(task.id)
      assert.equal(stored.dueDate, dueDate)
    })

  test('una cadena vacía quita la fecha, igual que null', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '' })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate: null, isOverdue: false })
    )
    const stored = await snapshot(task.id)
    assert.isNull(stored.dueDate)
  })

  test('rechaza un día que no existe y la tarea conserva la fecha que tenía', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-02-31' })

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_DATE_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('rechaza una fecha mal formada ({dueDate}) y la tarea conserva la que tenía')
    .with([
      { dueDate: '30/09/2026' },
      { dueDate: '2026-9-30' },
      { dueDate: '2026-09-30T00:00:00Z' },
      { dueDate: 'mañana' },
    ])
    .run(async ({ client, assert }, { dueDate }) => {
      const oscar = await createOscar()
      const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
      const before = await snapshot(task.id)

      const response = await putDueDate(client, task.id)
        .qs({ today: TODAY })
        .loginAs(oscar)
        .json({ dueDate })

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_DATE_ERROR)
      assert.deepEqual(await snapshot(task.id), before)
    })

  test('rechaza un día que no existe en una tarea sin fecha, que sigue sin ella', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2025-02-29' })

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_DATE_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
    assert.isNull(before.dueDate)
  })

  test('exige la clave dueDate: sin ella no cambia nada', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id).qs({ today: TODAY }).loginAs(oscar).json({})

    response.assertStatus(422)
    assert.deepEqual(response.body(), MISSING_DATE_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('rechaza una fecha fuera del rango ({dueDate}) y la tarea sigue sin fecha')
    .with([
      { dueDate: '0999-12-31', error: OUT_OF_RANGE_ERROR },
      { dueDate: '10000-01-01', error: INVALID_DATE_ERROR },
    ])
    .run(async ({ client, assert }, { dueDate, error }) => {
      const oscar = await createOscar()
      const task = await createTask({ assigneeId: oscar.id })
      const before = await snapshot(task.id)

      const response = await putDueDate(client, task.id)
        .qs({ today: TODAY })
        .loginAs(oscar)
        .json({ dueDate })

      response.assertStatus(422)
      assert.deepEqual(response.body(), error)
      assert.deepEqual(await snapshot(task.id), before)
      assert.isNull(before.dueDate)
    })

  test('rechaza un día de referencia que no existe y no escribe la fecha', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: '2026-02-31' })
      .loginAs(oscar)
      .json({ dueDate: '2026-11-01' })

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_TODAY_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('la fecha solo se lee del cuerpo, nunca de la query', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY, dueDate: '2026-11-01' })
      .loginAs(oscar)
      .json({})

    response.assertStatus(422)
    assert.deepEqual(response.body(), MISSING_DATE_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('sin día de referencia, decide si está vencida con la fecha UTC del servidor', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'pending', assigneeId: oscar.id })
    const createdAt = await fetchCreatedAt(client, oscar, task.id)
    const dueDate = DateTime.utc().minus({ days: 2 }).toISODate()

    const response = await putDueDate(client, task.id).loginAs(oscar).json({ dueDate })

    response.assertStatus(200)
    assert.deepEqual(
      response.body(),
      expectedDetail(task, oscar, createdAt, { dueDate, isOverdue: true })
    )
  })

  test('sin sesión iniciada, el cambio se rechaza y la tarea no cambia', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .json({ dueDate: '2026-11-01' })

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('con un token que no es válido, el cambio se rechaza y la tarea no cambia', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id, dueDate: '2026-10-15' })
    const before = await snapshot(task.id)

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .header('Authorization', 'Bearer oat_no-es-un-token')
      .json({ dueDate: '2026-11-01' })

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    assert.deepEqual(await snapshot(task.id), before)
  })

  test('avisa de que la tarea no existe si el id nunca existió', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await putDueDate(client, 999999)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('avisa de que la tarea no existe si se borró y no crea ninguna', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    await task.delete()

    const response = await putDueDate(client, task.id)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
    assert.lengthOf(await Task.query(), 0)
  })

  test('trata un id no numérico como tarea inexistente', async ({ client, assert }) => {
    const oscar = await createOscar()

    const response = await putDueDate(client, 'abc')
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: '2026-10-15' })

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('valida el cuerpo antes de buscar la tarea: inválido sobre id inexistente es 422', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()

    const response = await putDueDate(client, 999999)
      .qs({ today: TODAY })
      .loginAs(oscar)
      .json({ dueDate: 'mañana' })

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_DATE_ERROR)
  })
})
