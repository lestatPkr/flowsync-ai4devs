import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'

export type LogLine = Record<string, unknown> & { level: number; msg?: string }

/**
 * Reads the JSON lines of `tmp/logs/app.log` that belong to one request.
 *
 * The file target writes from a pino worker thread, so the lines land a
 * moment after the response. It polls until `until` is satisfied (by
 * default: the access line of the request, the one with `duration_ms`)
 * or the timeout runs out, and returns whatever it found.
 */
export async function logLinesFor(
  requestId: string,
  until: (lines: LogLine[]) => boolean = (lines) => lines.some((l) => 'duration_ms' in l),
  timeoutMs = 3000
): Promise<{ raw: string[]; lines: LogLine[] }> {
  const deadline = Date.now() + timeoutMs
  let raw: string[] = []
  let lines: LogLine[] = []

  while (Date.now() < deadline) {
    const content = await readFile(app.tmpPath('logs/app.log'), 'utf8').catch(() => '')
    raw = content.split('\n').filter((line) => line.includes(requestId))
    lines = raw.map((line) => JSON.parse(line) as LogLine)
    if (until(lines)) break
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return { raw, lines }
}
