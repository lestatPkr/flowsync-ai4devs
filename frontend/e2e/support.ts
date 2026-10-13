import { expect, type Page, type APIRequestContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export const API_URL = 'http://localhost:3333'

export type Member = { id: number; fullName: string; token: string }

/** Da de alta un miembro por la API, con un email que no choca con nada. */
export async function signUp(
  request: APIRequestContext,
  fullName: string,
): Promise<Member> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
  const response = await request.post(`${API_URL}/api/v1/auth/signup`, {
    data: {
      fullName,
      email,
      password: 'password123',
      passwordConfirmation: 'password123',
    },
    headers: { Accept: 'application/json' },
  })
  expect(response.status()).toBe(200)
  const { data } = await response.json()
  return { id: data.user.id, fullName, token: data.token }
}

/** Entra en la app con la sesión de ese miembro, sin pasar por el formulario de login. */
export async function signIn(page: Page, member: Member) {
  await page.addInitScript((token) => {
    window.localStorage.setItem('flowsync.token', token)
  }, member.token)
}

/** Crea una tarea por la API como ese miembro (nace en «Pendiente», asignada a él). */
export async function createTask(
  request: APIRequestContext,
  member: Member,
  title: string,
) {
  const response = await request.post(`${API_URL}/api/v1/tasks`, {
    data: { title },
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${member.token}`,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).data as { id: number; title: string }
}

/**
 * Sin violaciones graves ni críticas de WCAG 2.x A/AA en lo que hay en pantalla.
 * Es el sensor de accesibilidad de la Definition of Done del frontend.
 */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  )
  expect(
    serious.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([])
}

/** Deja una tarea en un estado por la API, como ese miembro. */
export async function setTaskStatus(
  request: APIRequestContext,
  member: Member,
  taskId: number,
  status: 'pending' | 'in_progress' | 'done',
) {
  const response = await request.patch(
    `${API_URL}/api/v1/tasks/${taskId}/status`,
    {
      data: { status },
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${member.token}`,
      },
    },
  )
  expect(response.ok()).toBe(true)
}

/** Pone la fecha de vencimiento ('AAAA-MM-DD') de una tarea por la API. */
export async function setTaskDueDate(
  request: APIRequestContext,
  member: Member,
  taskId: number,
  day: string,
) {
  const response = await request.put(
    `${API_URL}/api/v1/tasks/${taskId}/due-date`,
    {
      data: { dueDate: day },
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${member.token}`,
      },
    },
  )
  expect(response.ok()).toBe(true)
}

/** Si es la lectura de un estado de la lista: `GET /api/v1/tasks?status=…`. */
export const isTasksByStatusUrl = (url: URL) =>
  url.pathname === '/api/v1/tasks' && url.searchParams.has('status')

/**
 * Acota el tablero a las tareas cuyo título empieza por `prefix`: intercepta
 * GET /api/v1/tasks?status=*, hace la petición real (route.fetch) y responde
 * solo con esas filas. Para los escenarios que necesitan columnas vacías en una
 * BD compartida. Los PATCH no se tocan.
 */
export async function scopeBoardTo(page: Page, prefix: string) {
  await page.route(isTasksByStatusUrl, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const response = await route.fetch()
    if (!response.ok()) return route.fulfill({ response })
    const body = (await response.json()) as { data: { title: string }[] }
    await route.fulfill({
      response,
      json: {
        ...body,
        data: body.data.filter((task) => task.title.startsWith(prefix)),
      },
    })
  })
}

/** Borra una tarea por la API, como ese miembro. Falla si no responde `204`. */
export async function deleteTask(
  request: APIRequestContext,
  member: Member,
  taskId: number,
) {
  const response = await request.delete(`${API_URL}/api/v1/tasks/${taskId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${member.token}`,
    },
  })
  expect(response.status()).toBe(204)
}

/** Cierra la sesión de ese miembro por la API: su token deja de valer. */
export async function logOut(request: APIRequestContext, member: Member) {
  const response = await request.post(`${API_URL}/api/v1/account/logout`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${member.token}`,
    },
  })
  expect(response.ok()).toBe(true)
}

/**
 * El código HTTP de `GET /api/v1/tasks/:id` como ese miembro: `200` si la
 * tarea sigue, `404` si ya no está.
 */
export async function getTaskStatus(
  request: APIRequestContext,
  member: Member,
  taskId: number,
): Promise<number> {
  const response = await request.get(`${API_URL}/api/v1/tasks/${taskId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${member.token}`,
    },
  })
  return response.status()
}
