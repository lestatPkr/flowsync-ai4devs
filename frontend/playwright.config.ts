import { defineConfig, devices } from '@playwright/test'

// El puerto del frontend se puede cambiar (E2E_FRONTEND_PORT) para no probar otra app que ya ocupe
// el 5173: con reuseExistingServer, Playwright reutiliza lo que encuentre en esa URL, sea lo que sea.
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? '5173'

/**
 * e2e del frontend: la Definition of Done de lo que se ve (constitución, principio II).
 * Arranca backend y frontend si no están ya en marcha, y prueba contra los dos de verdad.
 * Ojo: el backend usa la misma SQLite que `npm run dev` (backend/tmp/db.sqlite3); cada test
 * crea sus propios usuarios con un email único, así que no pisa ni depende de lo que haya.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node ace serve',
      cwd: '../backend',
      url: 'http://localhost:3333',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
