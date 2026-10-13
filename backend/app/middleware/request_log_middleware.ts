import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Writes one JSON line per request once the response is done, and returns
 * the request id in the `X-Request-Id` header.
 *
 * Privacy by design (RNF-7, R9 of the threat model): the line only carries
 * technical fields. Never the user, the body, the query string or any
 * request header. `route` is the pattern (`/api/v1/tasks/:id`), not the URL.
 */
export default class RequestLogMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    const startedAt = process.hrtime.bigint()

    const requestId = ctx.request.id()
    if (requestId) {
      ctx.response.header('X-Request-Id', requestId)
    }

    /**
     * `close` fires once the response is written (or the client is gone),
     * after the exception handler has set the final status.
     */
    ctx.response.response.once('close', () => {
      ctx.logger.info(
        {
          method: ctx.request.method(),
          route: ctx.route?.pattern ?? null,
          status: ctx.response.response.statusCode,
          duration_ms: Number(process.hrtime.bigint() - startedAt) / 1e6,
        },
        'request completed'
      )
    })

    return next()
  }
}
