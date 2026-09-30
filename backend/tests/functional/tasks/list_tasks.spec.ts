import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import User from '#models/user'
import Task from '#models/task'

type TaskResponseBody = {
  id: number
  title: string
  status: string
  assignee: { id: number; fullName: string | null; initials: string }
}

test.group('Tasks list (GET /api/v1/tasks)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('devuelve todas las tareas del espacio compartido, no solo las de quien consulta', async ({
    client,
    assert,
  }) => {
    const author = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    const otherMember = await User.create({
      fullName: 'Ana Ruiz',
      email: 'ana@example.com',
      password: 'password123',
    })
    await Task.create({ title: 'Tarea de Oscar', status: 'pending', assigneeId: author.id })
    await Task.create({ title: 'Tarea de Ana', status: 'in_progress', assigneeId: otherMember.id })

    const response = await client.get('/api/v1/tasks').loginAs(otherMember)

    response.assertStatus(200)
    const tasks = response.body().data as TaskResponseBody[]
    assert.lengthOf(tasks, 2)
    assert.containsSubset(tasks, [
      { title: 'Tarea de Oscar', status: 'pending', assignee: { id: author.id } },
      { title: 'Tarea de Ana', status: 'in_progress', assignee: { id: otherMember.id } },
    ])
  })

  test('ordena las tareas de más reciente a más antigua', async ({ client, assert }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    const first = await Task.create({ title: 'Primera', status: 'pending', assigneeId: user.id })
    const second = await Task.create({ title: 'Segunda', status: 'pending', assigneeId: user.id })

    const response = await client.get('/api/v1/tasks').loginAs(user)

    const ids = (response.body().data as TaskResponseBody[]).map((task) => task.id)
    assert.deepEqual(ids, [second.id, first.id])
  })

  test('con el espacio sin tareas, devuelve una lista vacía', async ({ client, assert }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const response = await client.get('/api/v1/tasks').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [])
  })

  test('sin sesión iniciada, la lista se rechaza', async ({ client }) => {
    const response = await client.get('/api/v1/tasks')

    response.assertStatus(401)
  })

  test('CA-11: la lista no muestra la fecha ni la marca de vencida en ninguna tarea', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    await Task.create({ title: 'Sin fecha', status: 'pending', assigneeId: user.id })
    await Task.create({
      title: 'Con fecha futura',
      status: 'pending',
      assigneeId: user.id,
      dueDate: DateTime.fromISO('2999-10-15'),
    })
    await Task.create({
      title: 'Vencida',
      status: 'pending',
      assigneeId: user.id,
      dueDate: DateTime.fromISO('2026-09-01'),
    })

    const response = await client.get('/api/v1/tasks').loginAs(user)

    response.assertStatus(200)
    const rows = response.body().data as Record<string, unknown>[]
    assert.lengthOf(rows, 3)
    for (const row of rows) {
      assert.deepEqual(Object.keys(row).sort(), ['assignee', 'createdAt', 'id', 'status', 'title'])
    }
  })
})
