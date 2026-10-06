import { defineConfig, devices } from '@playwright/test'

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
    baseURL: 'http://localhost:5173',
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
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
