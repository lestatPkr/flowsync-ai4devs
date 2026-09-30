import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Task from '#models/task'

type TaskResponseBody = {
  id: number
  title: string
  status: string
  assignee: { id: number; fullName: string | null; initials: string }
}

test.group('Tasks create (POST /api/v1/tasks)', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('crea la tarea con el título indicado, asignada a quien la crea y en Pendiente', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const response = await client
      .post('/api/v1/tasks')
      .loginAs(user)
      .json({ title: 'Revisar el PR de auth' })

    response.assertStatus(201)
    const task = response.body().data as TaskResponseBody
    assert.equal(task.title, 'Revisar el PR de auth')
    assert.equal(task.status, 'pending')
    assert.equal(task.assignee.id, user.id)
  })

  test('rechaza un título vacío con un error en el campo title', async ({ client }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const response = await client.post('/api/v1/tasks').loginAs(user).json({ title: '' })

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'title' }] })
  })

  test('rechaza un título que solo tiene espacios en blanco', async ({ client }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const response = await client.post('/api/v1/tasks').loginAs(user).json({ title: '    ' })

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'title' }] })
  })

  test('recorta los espacios sobrantes al principio y al final del título', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const response = await client
      .post('/api/v1/tasks')
      .loginAs(user)
      .json({ title: '  Revisar el PR de auth  ' })

    response.assertStatus(201)
    assert.equal((response.body().data as TaskResponseBody).title, 'Revisar el PR de auth')
  })

  test('rechaza un título de más de 200 caracteres sin truncarlo', async ({ client, assert }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    const tooLong = 'a'.repeat(201)

    const response = await client.post('/api/v1/tasks').loginAs(user).json({ title: tooLong })

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'title', rule: 'maxLength' }] })
    assert.lengthOf(await Task.all(), 0)
  })

  test('sin sesión iniciada, la creación se rechaza', async ({ client }) => {
    const response = await client.post('/api/v1/tasks').json({ title: 'Revisar el PR de auth' })

    response.assertStatus(401)
  })

  test('CA-1: crear una tarea la deja sin fecha aunque el cuerpo traiga una', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const response = await client
      .post('/api/v1/tasks')
      .loginAs(user)
      .json({ title: 'Con fecha colada', dueDate: '2026-10-15' })

    response.assertStatus(201)
    const created = response.body().data as TaskResponseBody
    const stored = await Task.findOrFail(created.id)
    assert.isNull(stored.dueDate)

    const detail = await client
      .get(`/api/v1/tasks/${created.id}`)
      .qs({ today: '2026-09-30' })
      .loginAs(user)
    detail.assertStatus(200)
    assert.containsSubset(detail.body().data, { dueDate: null, isOverdue: false })
  })
})
