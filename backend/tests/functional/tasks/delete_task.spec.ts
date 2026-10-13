import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import User from '#models/user'
import Task, { type TaskStatus } from '#models/task'

const PASSWORD = 'password123'

/** A row of the list as the API returns it; only the id is read here. */
type ListedTask = { id: number }

function createOscar() {
  return User.create({
    fullName: 'Oscar Torres',
    email: 'oscar@example.com',
    password: PASSWORD,
  })
}

function createAna() {
  return User.create({
    fullName: 'Ana Ruiz',
    email: 'ana@example.com',
    password: PASSWORD,
  })
}

async function createTask({
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
  const task = await Task.create({
    title,
    status,
    assigneeId,
    ...(dueDate ? { dueDate: DateTime.fromISO(dueDate) } : {}),
  })
  // Re-read what was stored (SQLite keeps no milliseconds, and an unset
  // dueDate comes back as null), so `expectIntact` compares row with row.
  return task.refresh()
}

/**
 * What must not move when a delete is refused. `updatedAt` catches an
 * accidental write even if no visible value changes.
 */
async function snapshot(id: number) {
  const stored = await Task.findOrFail(id)
  return {
    title: stored.title,
    status: stored.status,
    assigneeId: stored.assigneeId,
    dueDate: stored.dueDate?.toISODate() ?? null,
    updatedAt: stored.updatedAt?.toMillis() ?? null,
  }
}

/** Re-reads the task and fails unless it is exactly as it was before the request. */
async function expectIntact(
  assert: { deepEqual: (actual: unknown, expected: unknown) => void },
  task: Task
) {
  assert.deepEqual(await snapshot(task.id), {
    title: task.title,
    status: task.status,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate?.toISODate() ?? null,
    updatedAt: task.updatedAt?.toMillis() ?? null,
  })
}

/** Rows in `tasks`, counted in the database itself. */
async function countTasks() {
  const [row] = await Task.query().count('* as total')
  return Number(row.$extras.total)
}

/** A real token of the member, obtained the way the app does: logging in. */
async function logIn(client: ApiClient, email: string) {
  const response = await client.post('/api/v1/auth/login').json({ email, password: PASSWORD })
  response.assertStatus(200)
  return response.body().data.token as string
}

const UNAUTHORIZED_ERROR = { errors: [{ message: 'Unauthorized access' }] }

const NOT_FOUND_ERROR = { errors: [{ message: 'Row not found' }] }

test.group('DELETE /api/v1/tasks/:id · US1 borrar una tarea, propia o ajena', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('#1 · 204 tarea propia: se borra sin cuerpo y la fila ya no está', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(204)
    assert.equal(response.text(), '')
    assert.isNull(await Task.find(task.id))
  })

  test('#2 · 204 tarea ajena (R10): se borra igual que una propia', async ({ client, assert }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask({ title: 'La de Ana', assigneeId: ana.id })

    const response = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(204)
    assert.equal(response.text(), '')
    assert.isNull(await Task.find(task.id))
  })

  test('#4 · 204 cualquier estado y con fecha: una tarea en «Hecho» con fecha se borra', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ status: 'done', dueDate: '2026-09-30', assigneeId: oscar.id })

    const response = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(204)
    assert.equal(response.text(), '')
    assert.isNull(await Task.find(task.id))
  })

  test('#5 · CA-2: borrada, ya no aparece en la lista de otra persona (por defecto ni «Hecho»)', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const pending = await createTask({ title: 'Borrar pendiente', assigneeId: ana.id })
    const done = await createTask({ title: 'Borrar hecha', status: 'done', assigneeId: ana.id })
    const keptPending = await createTask({ title: 'Sigue pendiente', assigneeId: ana.id })
    const keptDone = await createTask({ title: 'Sigue hecha', status: 'done', assigneeId: ana.id })

    const liveResponse = await client.get('/api/v1/tasks').loginAs(ana)
    const doneResponse = await client.get('/api/v1/tasks?status=done').loginAs(ana)
    const liveBefore = liveResponse.body().data as ListedTask[]
    const doneBefore = doneResponse.body().data as ListedTask[]
    assert.sameMembers(
      liveBefore.map((row) => row.id),
      [pending.id, keptPending.id]
    )
    assert.sameMembers(
      doneBefore.map((row) => row.id),
      [done.id, keptDone.id]
    )

    const deletePending = await client.delete(`/api/v1/tasks/${pending.id}`).loginAs(oscar)
    deletePending.assertStatus(204)
    const deleteDone = await client.delete(`/api/v1/tasks/${done.id}`).loginAs(oscar)
    deleteDone.assertStatus(204)

    const live = await client.get('/api/v1/tasks').loginAs(ana)
    const doneList = await client.get('/api/v1/tasks?status=done').loginAs(ana)

    live.assertStatus(200)
    assert.deepEqual(live.body(), {
      data: liveBefore.filter((row) => row.id === keptPending.id),
    })
    doneList.assertStatus(200)
    assert.deepEqual(doneList.body(), {
      data: doneBefore.filter((row) => row.id === keptDone.id),
    })
  })
})

test.group('DELETE /api/v1/tasks/:id · US2 guardarraíles', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('#8 · 401 sin sesión (R1): no borra y la tarea sigue intacta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client.delete(`/api/v1/tasks/${task.id}`)

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    await expectIntact(assert, task)
  })

  test('#9 · 401 token inventado (R1): no borra y la tarea sigue intacta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client
      .delete(`/api/v1/tasks/${task.id}`)
      .header('Authorization', 'Bearer oat_no-es-un-token')

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    await expectIntact(assert, task)
  })

  test('#10 · 401 token revocado por logout (R1): no borra y la tarea sigue intacta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const token = await logIn(client, oscar.email)
    const logout = await client
      .post('/api/v1/account/logout')
      .header('Authorization', `Bearer ${token}`)
    logout.assertStatus(200)

    const response = await client
      .delete(`/api/v1/tasks/${task.id}`)
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    await expectIntact(assert, task)
  })

  test('#16 · 404 borrar dos veces (R8): el segundo DELETE dice que no existe', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const first = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)
    first.assertStatus(204)

    const second = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    second.assertStatus(404)
    assert.deepEqual(second.body(), NOT_FOUND_ERROR)
  })
})

test.group('DELETE /api/v1/tasks/:id · US3 lo que pide el modelo de amenazas', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('#3 · 204 una entre varias (R3): borra solo esa y las demás siguen intactas', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const first = await createTask({ title: 'Primera', assigneeId: oscar.id })
    const middle = await createTask({ title: 'Segunda', assigneeId: oscar.id })
    const last = await createTask({ title: 'Tercera', assigneeId: oscar.id })
    const before = await countTasks()

    const response = await client.delete(`/api/v1/tasks/${middle.id}`).loginAs(oscar)

    response.assertStatus(204)
    assert.equal(await countTasks(), before - 1)
    assert.isNull(await Task.find(middle.id))
    await expectIntact(assert, first)
    await expectIntact(assert, last)
  })

  test('#6 · 404 ya no se puede abrir (R9, FR-022): GET de una tarea borrada por la API', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const deletion = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)
    deletion.assertStatus(204)

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
  })

  test('#7 · 204 el cuerpo no amplía el borrado (R3): con { ids } solo cae :id', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const a = await createTask({ title: 'A', assigneeId: oscar.id })
    const b = await createTask({ title: 'B', assigneeId: oscar.id })
    const c = await createTask({ title: 'C', assigneeId: oscar.id })
    const before = await countTasks()

    const response = await client
      .delete(`/api/v1/tasks/${a.id}`)
      .json({ ids: [b.id, c.id] })
      .loginAs(oscar)

    response.assertStatus(204)
    assert.equal(await countTasks(), before - 1)
    assert.isNull(await Task.find(a.id))
    await expectIntact(assert, b)
    await expectIntact(assert, c)
  })

  test('#11 · 401 token en la query (R2): ?token= no autentica y la tarea sigue intacta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const token = await logIn(client, oscar.email)

    const response = await client.delete(
      `/api/v1/tasks/${task.id}?token=${encodeURIComponent(token)}`
    )

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    await expectIntact(assert, task)
  })

  test('#12 · 401 token en una cookie (R2): no autentica y la tarea sigue intacta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const token = await logIn(client, oscar.email)

    const response = await client
      .delete(`/api/v1/tasks/${task.id}`)
      .header('Cookie', `token=${token}`)

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    await expectIntact(assert, task)
  })

  test('#13 · 401 sesión del guard web (R2): no autentica y la tarea sigue intacta', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client.delete(`/api/v1/tasks/${task.id}`).withGuard('web').loginAs(oscar)

    response.assertStatus(401)
    assert.deepEqual(response.body(), UNAUTHORIZED_ERROR)
    await expectIntact(assert, task)
  })

  test('#14 · 404 id inexistente (R4): no borra nada', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })
    const before = await countTasks()

    const response = await client.delete(`/api/v1/tasks/${task.id + 1000}`).loginAs(oscar)

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
    assert.equal(await countTasks(), before)
    await expectIntact(assert, task)
  })

  test('#15 · 404 id no numérico (R4): no borra nada', async ({ client, assert }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client.delete('/api/v1/tasks/abc').loginAs(oscar)

    response.assertStatus(404)
    assert.deepEqual(response.body(), NOT_FOUND_ERROR)
    await expectIntact(assert, task)
  })

  test('#17 · 404 id con otra forma que SQLite casaría (R4): 0T, T.0, Te0 y %20T no borran', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const t = await createTask({ title: 'T', assigneeId: oscar.id })
    const u = await createTask({ title: 'U', assigneeId: oscar.id })
    const before = await countTasks()

    for (const id of [`0${t.id}`, `${t.id}.0`, `${t.id}e0`, `%20${t.id}`]) {
      const response = await client.delete(`/api/v1/tasks/${id}`).loginAs(oscar)

      response.assertStatus(404)
      assert.deepEqual(response.body(), NOT_FOUND_ERROR)
    }

    assert.equal(await countTasks(), before)
    await expectIntact(assert, t)
    await expectIntact(assert, u)
  })

  test('#18 · 404 id negativo, cero, compuesto o con SQL (R4): no borran', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const t = await createTask({ title: 'T', assigneeId: oscar.id })
    const u = await createTask({ title: 'U', assigneeId: oscar.id })
    const before = await countTasks()

    for (const id of [`-${t.id}`, '0', `${t.id},${u.id}`, `${t.id}%20OR%201=1`]) {
      const response = await client.delete(`/api/v1/tasks/${id}`).loginAs(oscar)

      response.assertStatus(404)
      assert.deepEqual(response.body(), NOT_FOUND_ERROR)
    }

    assert.equal(await countTasks(), before)
    await expectIntact(assert, t)
    await expectIntact(assert, u)
  })

  test('#19 · sin colección (R3): DELETE /tasks no borra nada y uno válido deja N−1', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    await createTask({ title: 'Primera', assigneeId: oscar.id })
    const second = await createTask({ title: 'Segunda', assigneeId: oscar.id })
    await createTask({ title: 'Tercera', assigneeId: oscar.id })
    const n = await countTasks()

    const all = await client.delete('/api/v1/tasks').loginAs(oscar)
    all.assertStatus(404)
    const filtered = await client.delete('/api/v1/tasks?status=pending').loginAs(oscar)
    filtered.assertStatus(404)
    assert.equal(await countTasks(), n)

    const one = await client.delete(`/api/v1/tasks/${second.id}`).loginAs(oscar)

    one.assertStatus(204)
    assert.equal(await countTasks(), n - 1)
  })

  test('#20 · sin fugas (R7): 204 sin cuerpo y 404 exactamente { errors }', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const ana = await createAna()
    const task = await createTask({ title: 'La de Ana', assigneeId: ana.id })

    const deleted = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    deleted.assertStatus(204)
    assert.equal(deleted.text(), '')

    const again = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    again.assertStatus(404)
    assert.deepEqual(again.body(), { errors: [{ message: 'Row not found' }] })
  })

  test('#21 · no se puede incrustar (R6, API): el 204 lleva X-Frame-Options: DENY', async ({
    client,
    assert,
  }) => {
    const oscar = await createOscar()
    const task = await createTask({ assigneeId: oscar.id })

    const response = await client.delete(`/api/v1/tasks/${task.id}`).loginAs(oscar)

    response.assertStatus(204)
    assert.equal(response.header('x-frame-options'), 'DENY')
  })
})
