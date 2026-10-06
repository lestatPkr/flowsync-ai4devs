import { expect, test } from '@playwright/test'
import {
  createTask,
  expectNoSeriousA11yViolations,
  signIn,
  signUp,
} from './support'

test.describe('Humo: la app arranca y la lista se ve', () => {
  test('con sesión iniciada, la lista muestra las tareas del equipo y es accesible', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Torres')
    const task = await createTask(request, oscar, `Humo e2e ${Date.now()}`)
    await signIn(page, oscar)

    await page.goto('/tasks')

    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: task.title })).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })

  test('sin sesión, la lista lleva al login', async ({ page }) => {
    await page.goto('/tasks')

    await expect(page).toHaveURL(/\/login$/)
  })
})
