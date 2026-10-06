import { expect, test, type Page } from '@playwright/test'
import { createTask, signIn, signUp } from './support'

/**
 * Caracterización del control de estado de la lista (specs/006-tablero,
 * research §2): fija lo que hace hoy `TaskStatusSelect` antes de extraer su
 * reconciliación. Verde antes y después del refactor, sin tocar ninguna aserción.
 */

const unique = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const statusControl = (page: Page, title: string) =>
  page.getByRole('combobox', { name: `Estado de «${title}»` })

const isStatusPatch = (method: string, url: string, taskId: number) =>
  method === 'PATCH' && url.endsWith(`/api/v1/tasks/${taskId}/status`)

test.describe('Lista · control de estado (caracterización)', () => {
  test('Lista · cambiar el estado desde la fila se guarda y sigue así al recargar', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Lista Caracterización')
    const task = await createTask(request, member, unique('Fila guarda'))
    await signIn(page, member)
    await page.goto('/tasks')

    const control = statusControl(page, task.title)
    await expect(control).toHaveValue('pending')
    const saved = page.waitForResponse(
      (response) =>
        isStatusPatch(response.request().method(), response.url(), task.id) &&
        response.ok(),
    )
    await control.selectOption('in_progress')
    await saved

    await expect(control).toHaveValue('in_progress')
    await page.reload()
    await expect(statusControl(page, task.title)).toHaveValue('in_progress')
  })

  test('Lista · pasar una tarea a «Hecho» la saca de la vista por defecto', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Lista Caracterización')
    const task = await createTask(request, member, unique('Fila a hecho'))
    await signIn(page, member)
    await page.goto('/tasks')

    await expect(page.getByRole('link', { name: task.title })).toBeVisible()
    await statusControl(page, task.title).selectOption('done')

    await expect(page.getByRole('link', { name: task.title })).toHaveCount(0)
  })

  test('Lista · si el cambio no se guarda, el control vuelve al estado anterior con el mensaje de lib/api.ts', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Lista Caracterización')
    const task = await createTask(request, member, unique('Fila falla'))
    await signIn(page, member)
    await page.route('**/api/v1/tasks/*/status', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ errors: [{ message: 'Boom' }] }),
          })
        : route.fallback(),
    )
    await page.goto('/tasks')

    const control = statusControl(page, task.title)
    await control.selectOption('in_progress')

    await expect(control).toHaveValue('pending')
    await expect(page.locator(`#task-${task.id}-status-error`)).toHaveText(
      'Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.',
    )
    await expect(control).toHaveAttribute(
      'aria-describedby',
      `task-${task.id}-status-error`,
    )
    await expect(page.getByText('No se ha guardado el cambio.')).toHaveCount(0)
  })

  test('Lista · dos cambios seguidos acaban en el último elegido', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Lista Caracterización')
    const task = await createTask(request, member, unique('Fila cola'))
    await signIn(page, member)

    let release: () => void = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    let patches = 0
    await page.route('**/api/v1/tasks/*/status', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback()
      patches += 1
      if (patches === 1) await released
      await route.continue()
    })
    let savedPatches = 0
    page.on('response', (response) => {
      if (isStatusPatch(response.request().method(), response.url(), task.id))
        savedPatches += 1
    })
    await page.goto('/tasks')

    const control = statusControl(page, task.title)
    await control.selectOption('in_progress')
    await expect.poll(() => patches).toBe(1)
    await control.selectOption('pending')
    await expect(control).toHaveValue('pending')

    release()
    await expect.poll(() => savedPatches).toBe(2)

    await page.reload()
    await expect(statusControl(page, task.title)).toHaveValue('pending')
  })
})
