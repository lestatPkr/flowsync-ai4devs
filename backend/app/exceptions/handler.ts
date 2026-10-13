import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { errors as lucidErrors } from '@adonisjs/lucid'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    /**
     * A missing row (`findOrFail`) answers with the same `{ errors }` shape
     * as the 401 and 422 responses, in every environment.
     */
    if (error instanceof lucidErrors.E_ROW_NOT_FOUND) {
      return ctx.response.status(404).send({ errors: [{ message: 'Row not found' }] })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   *
   * Only 5xx are logged, with the request id (bound to `ctx.logger`), the
   * message and the stack. 4xx are the client's business and already show
   * up as the status of the request line. The error is logged field by
   * field, never whole, so none of its extra properties (or the request)
   * reaches the log (RNF-7).
   */
  async report(error: unknown, ctx: HttpContext) {
    const httpError = this.toHttpError(error)
    if (!this.shouldReport(httpError) || httpError.status < 500) {
      return
    }

    ctx.logger.error(
      { err: { message: httpError.message, stack: httpError.stack } },
      httpError.message
    )
  }
}
