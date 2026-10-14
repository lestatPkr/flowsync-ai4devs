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

    response.assertStatus(200)
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

    response.assertStatus(200)
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
})
