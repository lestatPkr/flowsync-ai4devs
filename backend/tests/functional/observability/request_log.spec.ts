import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Task from '#models/task'
import { logLinesFor } from './log_file.js'

test.group('Observability: request log', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('devuelve X-Request-Id en cada respuesta, distinto en dos peticiones', async ({
    client,
    assert,
  }) => {
    const first = await client.get('/')
    const second = await client.get('/api/v1/account/profile')

    const firstId = first.header('x-request-id')
    const secondId = second.header('x-request-id')
    assert.isString(firstId)
    assert.isString(secondId)
    assert.notEqual(firstId, secondId)
  })

  test('escribe una línea JSON por petición con request_id, method, route, status y duration_ms', async ({
    client,
    assert,
  }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })
    const task = await Task.create({ title: 'Revisar el PR de auth', assigneeId: user.id })

    const response = await client.get(`/api/v1/tasks/${task.id}`).loginAs(user)
    response.assertStatus(200)

    const requestId = response.header('x-request-id')!
    const { lines } = await logLinesFor(requestId)
    const accessLines = lines.filter((line) => 'duration_ms' in line)

    assert.lengthOf(accessLines, 1)
    const [line] = accessLines
    assert.equal(line.request_id, requestId)
    assert.equal(line.method, 'GET')
    assert.equal(line.route, '/api/v1/tasks/:id')
    assert.equal(line.status, 200)
    assert.isNumber(line.duration_ms)
  })

  test('la línea de una petición autenticada no lleva el email, el nombre ni el token', async ({
    client,
    assert,
  }) => {
    await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: 'oscar@example.com', password: 'password123' })
    login.assertStatus(200)
    const token = (login.body().data as { token: string }).token

    const profile = await client.get('/api/v1/account/profile').bearerToken(token)
    profile.assertStatus(200)

    for (const response of [login, profile]) {
      const requestId = response.header('x-request-id')!
      const { raw, lines } = await logLinesFor(requestId)

      assert.isTrue(lines.some((line) => line.status === 200 && 'route' in line))
      for (const line of raw) {
        assert.notInclude(line, 'oscar@example.com')
        assert.notInclude(line, 'Oscar Torres')
        assert.notInclude(line, 'password123')
        assert.notInclude(line, token)
        assert.notInclude(line.toLowerCase(), 'authorization')
      }
    }
  })

  test('un 404 deja su línea de acceso pero ninguna traza de error', async ({ client, assert }) => {
    const user = await User.create({
      fullName: 'Oscar Torres',
      email: 'oscar@example.com',
      password: 'password123',
    })

    const missingTask = await client.get('/api/v1/tasks/999999').loginAs(user)
    const missingRoute = await client.get('/api/v1/no-existe')

    for (const response of [missingTask, missingRoute]) {
      response.assertStatus(404)
      const { lines } = await logLinesFor(response.header('x-request-id')!)

      const accessLines = lines.filter((line) => 'duration_ms' in line)
      assert.lengthOf(accessLines, 1)
      assert.equal(accessLines[0].status, 404)
      assert.isEmpty(lines.filter((line) => line.level >= 40))
    }
  })
})
