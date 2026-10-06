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
