import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Task from '#models/task'

type TaskResponseBody = {
  id: number
  title: string
  assignee: { id: number; fullName: string | null; initials: string }
}

test.group('Tasks list (GET /api/v1/tasks) con un miembro sin nombre', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('la lista no se rompe si una tarea es de alguien sin nombre', async ({ client, assert }) => {
    const withName = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    const withoutName = await User.create({
      fullName: null,
      email: 'ana@example.com',
      password: 'password123',
    })
    await Task.create({ title: 'Tarea de Oscar', status: 'pending', assigneeId: withName.id })
    await Task.create({ title: 'Tarea de Ana', status: 'pending', assigneeId: withoutName.id })

    const response = await client.get('/api/v1/tasks').loginAs(withName)

    response.assertStatus(200)
    const tasks = response.body().data as TaskResponseBody[]
    assert.lengthOf(tasks, 2)
    assert.containsSubset(tasks, [
      { title: 'Tarea de Oscar', assignee: { id: withName.id, fullName: 'Oscar Torres' } },
      {
        title: 'Tarea de Ana',
        assignee: { id: withoutName.id, fullName: null, initials: 'AE' },
      },
    ])
  })
})
