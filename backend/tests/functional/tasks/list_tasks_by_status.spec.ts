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

const LIVE: TaskStatus[] = ['pending', 'in_progress']

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
  title: string,
  dueDate: string | null = null
) {
  return Task.create({
    title,
    status,
    assigneeId: assignee.id,
    dueDate: dueDate ? DateTime.fromISO(dueDate) : null,
  })
}

/**
 * The common space: Oscar and Ana, both with tasks in the three statuses and
 * two tasks per status, so «all of a status» is never mistaken for «one». The
 * statuses are interleaved on purpose, so a filter cannot pass by slicing.
 */
async function seedSpace() {
  const oscar = await createOscar()
  const ana = await createAna()
  await createTask(oscar, 'pending', 'Preparar la demo', '2026-10-15')
  await createTask(ana, 'in_progress', 'Revisar el PR de auth')
  await createTask(oscar, 'done', 'Configurar el CI', '2026-09-01')
  await createTask(ana, 'pending', 'Escribir el changelog')
  await createTask(oscar, 'in_progress', 'Migrar la base de datos')
  await createTask(ana, 'done', 'Cerrar el sprint')
  return { oscar, ana }
}

/**
 * The `createdAt` is taken from the detail (GET /api/v1/tasks/:id), never from
 * the list under test, so the test does not depend on how Luxon serializes dates.
 */
async function fetchCreatedAt(client: ApiClient, viewer: User, id: number) {
  const response = await client.get(`/api/v1/tasks/${id}`).loginAs(viewer)
  return (response.body().data as TaskResponseBody).createdAt
}

async function expectedRow(client: ApiClient, viewer: User, task: Task) {
  await task.load('assignee')
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    createdAt: await fetchCreatedAt(client, viewer, task.id),
    assignee: {
      id: task.assignee.id,
      fullName: task.assignee.fullName,
      initials: task.assignee.initials,
    },
  }
}

/**
 * The whole expected body of the list for the given statuses, as they are now
 * in the database, in the order of the list: `createdAt` desc, `id` desc.
 */
async function expectedList(client: ApiClient, viewer: User, statuses: TaskStatus[]) {
  const tasks = await Task.query().whereIn('status', statuses)
  const rows = await Promise.all(tasks.map((task) => expectedRow(client, viewer, task)))
  rows.sort(
    (a, b) =>
      DateTime.fromISO(b.createdAt).toMillis() - DateTime.fromISO(a.createdAt).toMillis() ||
      b.id - a.id
  )
  return { data: rows }
}

/**
 * What must not move when the list is only read, straight from the table.
 * `updated_at` catches an accidental write even if no visible value changes.
 */
function snapshot() {
  return db
    .from('tasks')
    .select('id', 'status', 'title', 'assignee_id', 'due_date', 'updated_at')
    .orderBy('id')
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

const UNAUTHORIZED_ERROR = { errors: [{ message: 'Unauthorized access' }] }

test.group('Tasks list by status (GET /api/v1/tasks?status=)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('US1-1 — sin estado: todas las pendientes y en curso, ninguna hecha', async ({
    client,
    assert,
  }) => {
    const { oscar } = await seedSpace()

    const response = await client.get('/api/v1/tasks').loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), await expectedList(client, oscar, LIVE))
  })

  test('US1-2 — «Pendiente»: todas las pendientes, ninguna en curso ni hecha', async ({
    client,
    assert,
  }) => {
    const { oscar } = await seedSpace()

    const response = await client.get('/api/v1/tasks?status=pending').loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), await expectedList(client, oscar, ['pending']))
  })

  test('US1-3 — «En curso»: todas las que están en curso, ninguna pendiente ni hecha', async ({
    client,
    assert,
  }) => {
    const { oscar } = await seedSpace()

    const response = await client.get('/api/v1/tasks?status=in_progress').loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), await expectedList(client, oscar, ['in_progress']))
  })

  test('US1-4 — «Hecho»: todas las hechas, que la lista sin filtro no incluye', async ({
    client,
    assert,
  }) => {
    const { oscar } = await seedSpace()

    const done = await client.get('/api/v1/tasks?status=done').loginAs(oscar)
    const unfiltered = await client.get('/api/v1/tasks').loginAs(oscar)

    done.assertStatus(200)
    assert.deepEqual(done.body(), await expectedList(client, oscar, ['done']))
    unfiltered.assertStatus(200)
    assert.deepEqual(unfiltered.body(), await expectedList(client, oscar, LIVE))
  })

  test('US1-5 — estado válido sin tareas: lista vacía, no un error', async ({ client, assert }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    await createTask(oscar, 'pending', 'Preparar la demo')
    await createTask(ana, 'done', 'Cerrar el sprint')

    const response = await client.get('/api/v1/tasks?status=in_progress').loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: [] })
  })

  test('US1-6 — estado que no es ninguno de los tres ({status}) se rechaza y no devuelve lista')
    .with([
      { status: 'archivada' },
      { status: 'all' },
      { status: 'Pendiente' },
      { status: 'PENDING' },
      { status: '' },
    ])
    .run(async ({ client, assert }, { status }) => {
      const { oscar } = await seedSpace()

      const response = await client
        .get(`/api/v1/tasks?status=${encodeURIComponent(status)}`)
        .loginAs(oscar)

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_STATUS_ERROR)
    })

  test('US1-7 — el rechazo señala el estado, da los válidos y no se confunde con un filtro sin resultados', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    await createTask(oscar, 'pending', 'Preparar la demo')
    await createTask(ana, 'done', 'Cerrar el sprint')

    const invalid = await client.get('/api/v1/tasks?status=archivada').loginAs(oscar)
    const empty = await client.get('/api/v1/tasks?status=in_progress').loginAs(oscar)

    invalid.assertStatus(422)
    assert.deepEqual(invalid.body(), INVALID_STATUS_ERROR)
    empty.assertStatus(200)
    assert.deepEqual(empty.body(), { data: [] })
    assert.notEqual(invalid.status(), empty.status())
    assert.notDeepEqual(invalid.body(), empty.body())
  })

  test('US1-8 — mezclar las hechas con el resto se rechaza ({case})')
    .with([
      { case: 'dos estados en la misma petición', query: 'status=pending&status=done' },
      { case: '«todas»', query: 'status=todas' },
      { case: 'dos estados separados por comas', query: 'status=pending,done' },
    ])
    .run(async ({ client, assert }, { query }) => {
      const { oscar } = await seedSpace()

      const response = await client.get(`/api/v1/tasks?${query}`).loginAs(oscar)

      response.assertStatus(422)
      assert.deepEqual(response.body(), INVALID_STATUS_ERROR)
    })

  test('US1-9 — pasar a «Hecho» la saca de la lista sin filtro y la pone en «Hecho»; devolverla la trae de vuelta', async ({
    client,
    assert,
  }) => {
    const { oscar } = await seedSpace()
    const task = await Task.findByOrFail('title', 'Preparar la demo')

    const toDone = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'done' })
    toDone.assertStatus(200)

    const unfilteredAfterDone = await client.get('/api/v1/tasks').loginAs(oscar)
    const doneAfterDone = await client.get('/api/v1/tasks?status=done').loginAs(oscar)
    assert.deepEqual(unfilteredAfterDone.body(), await expectedList(client, oscar, LIVE))
    assert.deepEqual(doneAfterDone.body(), await expectedList(client, oscar, ['done']))
    assert.notInclude(
      (unfilteredAfterDone.body().data as TaskResponseBody[]).map((row) => row.id),
      task.id
    )
    assert.include(
      (doneAfterDone.body().data as TaskResponseBody[]).map((row) => row.id),
      task.id
    )

    const backToPending = await client
      .patch(`/api/v1/tasks/${task.id}/status`)
      .loginAs(oscar)
      .json({ status: 'pending' })
    backToPending.assertStatus(200)

    const unfilteredAfterBack = await client.get('/api/v1/tasks').loginAs(oscar)
    const doneAfterBack = await client.get('/api/v1/tasks?status=done').loginAs(oscar)
    assert.deepEqual(unfilteredAfterBack.body(), await expectedList(client, oscar, LIVE))
    assert.deepEqual(doneAfterBack.body(), await expectedList(client, oscar, ['done']))
    assert.include(
      (unfilteredAfterBack.body().data as TaskResponseBody[]).map((row) => row.id),
      task.id
    )
    assert.notInclude(
      (doneAfterBack.body().data as TaskResponseBody[]).map((row) => row.id),
      task.id
    )
  })

  test('US1-10 — pedir la lista, con cualquier filtro, válido o no, no modifica ninguna tarea', async ({
    client,
    assert,
  }) => {
    const { oscar, ana } = await seedSpace()
    await db.from('tasks').update({ updated_at: '2026-01-01 00:00:00' })
    const before = await snapshot()

    await client.get('/api/v1/tasks').loginAs(oscar)
    await client.get('/api/v1/tasks?status=pending').loginAs(ana)
    await client.get('/api/v1/tasks?status=in_progress').loginAs(oscar)
    await client.get('/api/v1/tasks?status=done').loginAs(ana)
    await client.get('/api/v1/tasks?status=archivada').loginAs(oscar)
    await client.get('/api/v1/tasks?status=').loginAs(ana)
    await client.get('/api/v1/tasks?status=done')

    assert.lengthOf(before, 6)
    assert.deepEqual(await snapshot(), before)
  })

  test('US1-11 — una lista vacía permite saber si el espacio no tiene tareas o si ninguna encaja', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()

    const emptyUnfiltered = await client.get('/api/v1/tasks').loginAs(oscar)
    const emptyDone = await client.get('/api/v1/tasks?status=done').loginAs(oscar)
    emptyUnfiltered.assertStatus(200)
    assert.deepEqual(emptyUnfiltered.body(), { data: [] })
    emptyDone.assertStatus(200)
    assert.deepEqual(emptyDone.body(), { data: [] })

    await createTask(oscar, 'done', 'Configurar el CI')
    await createTask(oscar, 'done', 'Cerrar el sprint')

    const allDoneUnfiltered = await client.get('/api/v1/tasks').loginAs(oscar)
    const allDoneDone = await client.get('/api/v1/tasks?status=done').loginAs(oscar)
    allDoneUnfiltered.assertStatus(200)
    assert.deepEqual(allDoneUnfiltered.body(), { data: [] })
    allDoneDone.assertStatus(200)
    assert.deepEqual(allDoneDone.body(), await expectedList(client, oscar, ['done']))
    assert.lengthOf(allDoneDone.body().data, 2)
  })

  test('US1-12 — sin sesión no recibe ninguna tarea, con o sin filtro ({case})')
    .with([
      { case: 'sin filtro, sin token', url: '/api/v1/tasks', token: null },
      { case: '«Hecho», sin token', url: '/api/v1/tasks?status=done', token: null },
      { case: 'filtro no válido, sin token', url: '/api/v1/tasks?status=archivada', token: null },
      { case: 'sin filtro, token inválido', url: '/api/v1/tasks', token: 'oat_invalid' },
      { case: '«Hecho», token inválido', url: '/api/v1/tasks?status=done', token: 'oat_invalid' },
      {
        case: 'filtro no válido, token inválido',
        url: '/api/v1/tasks?status=archivada',
        token: 'oat_invalid',
      },
    ])
    .run(async ({ client, assert }, { url, token }) => {
      await seedSpace()

      const request = client.get(url)
      if (token) {
        request.header('Authorization', `Bearer ${token}`)
      }
      const response = await request

      response.assertStatus(401)
      assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    })

  test('Edge — en un espacio sin tareas, un filtro no válido se sigue rechazando', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()

    const response = await client.get('/api/v1/tasks?status=archivada').loginAs(oscar)

    response.assertStatus(422)
    assert.deepEqual(response.body(), INVALID_STATUS_ERROR)
  })

  test('FR-011 — el estado es la única dimensión: cualquier otro parámetro no filtra', async ({
    client,
    assert,
  }) => {
    const { oscar, ana } = await seedSpace()

    const unfiltered = await client.get('/api/v1/tasks').loginAs(oscar)
    const byAssignee = await client.get(`/api/v1/tasks?assigneeId=${ana.id}`).loginAs(oscar)
    const byDay = await client.get('/api/v1/tasks?today=2026-09-29').loginAs(oscar)

    unfiltered.assertStatus(200)
    assert.includeMembers(
      (unfiltered.body().data as TaskResponseBody[]).map((row) => row.assignee.id),
      [oscar.id, ana.id]
    )
    byAssignee.assertStatus(200)
    assert.deepEqual(byAssignee.body(), unfiltered.body())
    byDay.assertStatus(200)
    assert.deepEqual(byDay.body(), unfiltered.body())
  })

  test('Assumptions — la lista filtrada mantiene el orden de la lista', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const first = await createTask(oscar, 'pending', 'Primera')
    await createTask(oscar, 'in_progress', 'Intercalada')
    const second = await createTask(oscar, 'pending', 'Segunda')
    const third = await createTask(oscar, 'pending', 'Tercera')

    const response = await client.get('/api/v1/tasks?status=pending').loginAs(oscar)

    response.assertStatus(200)
    assert.deepEqual(response.body(), {
      data: [
        await expectedRow(client, oscar, third),
        await expectedRow(client, oscar, second),
        await expectedRow(client, oscar, first),
      ],
    })
  })
})
