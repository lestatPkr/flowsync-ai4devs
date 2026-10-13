import { test } from '@japa/runner'
import { errors as lucidErrors } from '@adonisjs/lucid'
import testUtils from '@adonisjs/core/services/test_utils'
import HttpExceptionHandler from '#exceptions/handler'
import { logLinesFor } from './log_file.js'

test.group('Observability: error report', () => {
  test('un 5xx se registra con request_id, el mensaje y la pila', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    const requestId = ctx.request.id()!

    await new HttpExceptionHandler().report(new Error('se ha caído la base de datos'), ctx)

    const { lines } = await logLinesFor(requestId, (found) => found.length > 0)
    assert.lengthOf(lines, 1)
    const [line] = lines
    assert.equal(line.level, 50)
    assert.equal(line.request_id, requestId)
    assert.equal(line.msg, 'se ha caído la base de datos')
    assert.include((line.err as { stack: string }).stack, 'error_report.spec')
  })

  test('un 4xx no deja ninguna línea en el log', async ({ assert }) => {
    const ctx = await testUtils.createHttpContext()
    const requestId = ctx.request.id()!

    await new HttpExceptionHandler().report(new lucidErrors.E_ROW_NOT_FOUND(), ctx)

    const { lines } = await logLinesFor(requestId, (found) => found.length > 0, 500)
    assert.isEmpty(lines)
  })
})
