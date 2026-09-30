import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import User from '#models/user'
import Task from '#models/task'

const TODAY = '2026-09-30'

test.group('Tasks overdue, mismo día (GET /api/v1/tasks/:id?today=)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('mismo día: vencer hoy todavía no es estar vencida', async ({ client, assert }) => {
    const oscar = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    const task = await Task.create({
      title: 'Revisar el PR de auth',
      status: 'pending',
      assigneeId: oscar.id,
      dueDate: DateTime.fromISO(TODAY),
    })

    const response = await client
      .get(`/api/v1/tasks/${task.id}`)
      .qs({ today: TODAY })
      .loginAs(oscar)

    response.assertStatus(200)
    assert.equal(response.body().data.dueDate, TODAY)
    assert.isFalse(response.body().data.isOverdue)
  })
})
