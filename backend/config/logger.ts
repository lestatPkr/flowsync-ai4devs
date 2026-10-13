import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, targets } from '@adonisjs/core/logger'

const loggerConfig = defineConfig({
  /**
   * Default logger name used by ctx.logger and app logger calls.
   */
  default: 'app',

  loggers: {
    app: {
      /**
       * Toggle this logger on/off.
       */
      enabled: true,

      /**
       * Logger name shown in log records.
       */
      name: env.get('APP_NAME'),

      /**
       * Minimum level to output (trace, debug, info, warn, error, fatal).
       */
      level: env.get('LOG_LEVEL'),

      /**
       * Configure where logs are written: stdout (pretty in development,
       * JSON in production, muted in tests to keep the reporter readable)
       * plus one JSON line per record in tmp/logs/app.log, in every
       * environment.
       */
      transport: {
        targets: targets()
          .pushIf(app.inDev, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .push(targets.file({ destination: app.tmpPath('logs/app.log'), mkdir: true }))
          .toArray(),
      },
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
