import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test'
import {
  createTask,
  expectNoSeriousA11yViolations,
  isTasksByStatusUrl,
  scopeBoardTo,
  setTaskDueDate,
  setTaskStatus,
  signIn,
  signUp,
} from './support'

/**
 * La matriz del tablero (specs/006-tablero, contracts/board-ui.md): un test por
 * escenario de aceptación, contra el backend real. La BD es compartida, así
 * que cada test crea sus miembros y tareas con títulos únicos, cuenta por
 * invariante o por diferencia, y acota el tablero con `scopeBoardTo` cuando
 * necesita columnas vacías o un recorrido corto con el teclado.
 */

type Status = 'pending' | 'in_progress' | 'done'

const LABELS: Record<Status, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Hecho',
}

const STATUSES: Status[] = ['pending', 'in_progress', 'done']

const unique = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const column = (page: Page, status: Status) =>
  page.getByRole('region', { name: new RegExp(`^${LABELS[status]} \\(`) })

const titleLink = (scope: Page | Locator, title: string) =>
  scope.getByRole('link', { name: title, exact: true })

// El `has` de `filter` se busca dentro de cada `listitem`: su localizador tiene
// que partir de la página, no de `scope`.
const cardIn = (scope: Page | Locator, title: string) =>
  scope.getByRole('listitem').filter({
    has: titleLink('page' in scope ? scope.page() : scope, title),
  })

const statusControl = (scope: Page | Locator, title: string) =>
  scope.getByRole('combobox', { name: `Estado de «${title}»` })

const statusError = (page: Page, taskId: number) =>
  page.locator(`#task-${taskId}-status-error`)

/** El recuento que dice el encabezado de la columna: «Pendiente (3 tareas)». */
async function headerCount(page: Page, status: Status) {
  const text = await column(page, status)
    .getByRole('heading', { level: 2 })
    .textContent()
  const match = text?.match(/\((\d+) tareas?\)/)
  expect(match, `recuento en «${text}»`).not.toBeNull()
  return Number(match![1])
}

async function counts(page: Page) {
  return {
    pending: await headerCount(page, 'pending'),
    in_progress: await headerCount(page, 'in_progress'),
    done: await headerCount(page, 'done'),
  }
}

/** Abre el tablero y espera a que esté cargado (tres columnas). */
async function openBoard(page: Page) {
  await page.goto('/tasks/board')
  await expect(
    page.getByRole('heading', { name: 'Tablero', level: 1 }),
  ).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(3)
}

/** Arrastra una tarjeta (cogida por su margen, no por el enlace ni el control). */
async function drag(card: Locator, target: Locator) {
  await card.dragTo(target, {
    sourcePosition: { x: 10, y: 10 },
    targetPosition: { x: 16, y: 16 },
  })
}

/** Pulsa `key` hasta que `target` tiene el foco (o falla tras `max` pulsaciones). */
async function pressUntilFocused(
  page: Page,
  target: Locator,
  key: 'Tab' | 'Shift+Tab' = 'Tab',
  max = 20,
) {
  await expect(target).toBeVisible()
  for (let step = 0; step < max; step += 1) {
    await page.keyboard.press(key)
    if (await target.evaluate((element) => element === document.activeElement))
      return
  }
  await expect(target).toBeFocused()
}

const isStatusPatch = (route: Route) => route.request().method() === 'PATCH'

/** Todos los `PATCH …/status` responden con `respond`; el resto, al backend. */
async function interceptStatusChanges(
  page: Page,
  respond: (route: Route) => Promise<void>,
) {
  await page.unroute('**/api/v1/tasks/*/status')
  await page.route('**/api/v1/tasks/*/status', (route) =>
    isStatusPatch(route) ? respond(route) : route.fallback(),
  )
}

const serverError = (route: Route) =>
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ errors: [{ message: 'Boom' }] }),
  })

/** Una puerta que el test abre cuando quiere soltar una respuesta retenida. */
function gate() {
  let open: () => void = () => {}
  const opened = new Promise<void>((resolve) => {
    open = resolve
  })
  return { opened, open }
}

test.describe('US1 · ver el tablero y abrir una tarea', () => {
  test('US1-1 · DADO tareas en los tres estados, CUANDO abre el tablero, ENTONCES ve tres columnas en orden y cada tarea una sola vez en la de su estado, sea suya o de otra persona', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Tablero')
    const ana = await signUp(request, 'Ana Tablero')
    const placed: { title: string; status: Status }[] = []
    for (const member of [oscar, ana]) {
      for (const status of STATUSES) {
        const task = await createTask(
          request,
          member,
          unique(`US1-1 ${status}`),
        )
        if (status !== 'pending')
          await setTaskStatus(request, member, task.id, status)
        placed.push({ title: task.title, status })
      }
    }
    await signIn(page, oscar)

    await openBoard(page)

    const regions = page.getByRole('region')
    await expect(regions.nth(0)).toHaveAccessibleName(/^Pendiente \(/)
    await expect(regions.nth(1)).toHaveAccessibleName(/^En curso \(/)
    await expect(regions.nth(2)).toHaveAccessibleName(/^Hecho \(/)
    for (const { title, status } of placed) {
      await expect(titleLink(page, title)).toHaveCount(1)
      await expect(titleLink(column(page, status), title)).toHaveCount(1)
    }
  })

  test('US1-2 · DADO tareas hechas, CUANDO abre el tablero, ENTONCES están en «Hecho» sin elegir ningún filtro', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US1-2 hecha'))
    await setTaskStatus(request, member, task.id, 'done')
    await signIn(page, member)

    await openBoard(page)

    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Filtrar por estado' }),
    ).toHaveCount(0)
  })

  test('US1-3 · DADO un tablero cargado, CUANDO mira cada cabecera, ENTONCES ve el nombre del estado y un recuento igual a sus tarjetas', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    for (const status of STATUSES) {
      const task = await createTask(request, member, unique(`US1-3 ${status}`))
      if (status !== 'pending')
        await setTaskStatus(request, member, task.id, status)
    }
    await signIn(page, member)

    await openBoard(page)

    for (const status of STATUSES) {
      const region = column(page, status)
      await expect(region.getByRole('heading', { level: 2 })).toContainText(
        LABELS[status],
      )
      expect(await headerCount(page, status)).toBe(
        await region.getByRole('listitem').count(),
      )
    }
  })

  test('US1-4 · DADO un tablero cargado, CUANDO mira una tarjeta, ENTONCES ve título, responsable y estado, y nada de prioridad, foto, vencimiento ni marca de vencida', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Zoe Quintana')
    const task = await createTask(request, member, unique('US1-4 tarjeta'))
    await setTaskDueDate(request, member, task.id, '2020-01-15')
    await signIn(page, member)

    await openBoard(page)

    const card = cardIn(column(page, 'pending'), task.title)
    await expect(titleLink(card, task.title)).toBeVisible()
    await expect(card.getByText('Zoe Quintana', { exact: true })).toBeVisible()
    await expect(statusControl(card, task.title)).toHaveValue('pending')
    for (const absent of ['Vence', 'Vencida', '2020', '15 de enero', 'ZQ']) {
      await expect(card).not.toContainText(absent)
    }
    await expect(card.getByRole('img')).toHaveCount(0)
    await expect(card.locator('img')).toHaveCount(0)
  })

  test('US1-5 · DADO un miembro en el tablero, CUANDO activa el título de una tarjeta, ENTONCES llega a la vista de esa tarea', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US1-5 abrir'))
    await signIn(page, member)

    await openBoard(page)
    await titleLink(page, task.title).click()

    await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`))
    await expect(
      page.getByRole('heading', { name: task.title, level: 1 }),
    ).toBeVisible()
  })

  test('US1-6 · DADO una tarea abierta desde el tablero, CUANDO vuelve, ENTONCES regresa al tablero con el foco en esa tarjeta', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US1-6 volver'))
    await signIn(page, member)

    await openBoard(page)
    await titleLink(page, task.title).click()
    await expect(
      page.getByRole('heading', { name: task.title, level: 1 }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Volver al tablero' }).click()

    await expect(page).toHaveURL(/\/tasks\/board$/)
    await expect(titleLink(page, task.title)).toBeFocused()
  })

  test('US1-7 · DADO la lista, CUANDO quiere ver el tablero, ENTONCES llega con una interacción; Y desde el tablero vuelve a la lista con otra', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    await signIn(page, member)
    await page.goto('/tasks')
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()

    const boardLink = page.getByRole('link', { name: 'Tablero', exact: true })
    await expect(boardLink).toBeVisible()
    await boardLink.click()
    await expect(page).toHaveURL(/\/tasks\/board$/)
    await expect(
      page.getByRole('heading', { name: 'Tablero', level: 1 }),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Lista', exact: true }).click()
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()
  })

  test('US1-8 · DADO un miembro que usó el tablero, CUANDO entra a FlowSync sin indicar vista, ENTONCES aparece en la lista', async ({
    page,
    request,
    browser,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    await signIn(page, member)
    await page.goto('/tasks/board')
    await expect(
      page.getByRole('heading', { name: 'Tablero', level: 1 }),
    ).toBeVisible()

    await page.goto('/')
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()

    const context = await browser.newContext()
    try {
      const fresh = await context.newPage()
      await signIn(fresh, member)
      await fresh.goto('http://localhost:5173/')
      await expect(fresh).toHaveURL(/\/tasks$/)
      await expect(
        fresh.getByRole('heading', { name: 'Tareas', level: 1 }),
      ).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test('US1-9 · DADO solo el teclado, CUANDO va de la lista al tablero, recorre las tarjetas, abre una tarea, vuelve y regresa a la lista, ENTONCES puede hacerlo todo en orden de columnas y tarjetas', async ({
    page,
    request,
  }) => {
    const prefix = unique('US1-9')
    const member = await signUp(request, 'Oscar Tablero')
    const first = await createTask(request, member, `${prefix} p1`)
    const second = await createTask(request, member, `${prefix} p2`)
    const ongoing = await createTask(request, member, `${prefix} ip`)
    await setTaskStatus(request, member, ongoing.id, 'in_progress')
    const finished = await createTask(request, member, `${prefix} d`)
    await setTaskStatus(request, member, finished.id, 'done')
    await scopeBoardTo(page, prefix)
    await signIn(page, member)
    await page.goto('/tasks')
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()

    // De la lista al tablero.
    const boardLink = page.getByRole('link', { name: 'Tablero', exact: true })
    await pressUntilFocused(page, boardLink)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/tasks\/board$/)
    await expect(page.getByRole('region')).toHaveCount(3)

    // Título y control de cada tarjeta, columna a columna, de arriba abajo.
    const listLink = page.getByRole('link', { name: 'Lista', exact: true })
    await pressUntilFocused(page, listLink)
    for (const task of [second, first, ongoing, finished]) {
      await page.keyboard.press('Tab')
      await expect(titleLink(page, task.title)).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(statusControl(page, task.title)).toBeFocused()
    }

    // Abre una tarea y vuelve al tablero, a esa tarjeta.
    await page.keyboard.press('Shift+Tab')
    await expect(titleLink(page, finished.title)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/tasks/${finished.id}$`))
    const back = page.getByRole('link', { name: 'Volver al tablero' })
    await pressUntilFocused(page, back)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/tasks\/board$/)
    await expect(titleLink(page, finished.title)).toBeFocused()

    // Y de vuelta a la lista.
    await pressUntilFocused(page, listLink, 'Shift+Tab')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()
  })

  test('US1-10 · DADO un tablero que no consigue cargar, CUANDO lo mira, ENTONCES ve un mensaje y «Reintentar», y no tres columnas vacías', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    await signIn(page, member)
    await page.route(isTasksByStatusUrl, (route) =>
      route.request().method() === 'GET'
        ? serverError(route)
        : route.fallback(),
    )

    await page.goto('/tasks/board')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('No se ha podido cargar el tablero')
    const retry = alert.getByRole('button', { name: 'Reintentar' })
    await expect(retry).toBeVisible()
    await expect(page.getByRole('region')).toHaveCount(0)
    await expectNoSeriousA11yViolations(page)

    await page.unroute(isTasksByStatusUrl)
    await retry.click()
    await expect(page.getByRole('region')).toHaveCount(3)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('US1-11 · DADO una persona sin sesión, CUANDO intenta llegar al tablero, ENTONCES no ve ninguna tarea', async ({
    page,
    request,
  }) => {
    await page.goto('/tasks/board')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('region')).toHaveCount(0)

    const member = await signUp(request, 'Oscar Tablero')
    await signIn(page, member)
    await page.goto('/tasks/board')
    await expect(
      page.getByRole('heading', { name: 'Tablero', level: 1 }),
    ).toBeVisible()
  })
})

test.describe('US2 · mover de columna', () => {
  test('US2-1 · DADO una tarjeta en «Pendiente», CUANDO la arrastra a «En curso», ENTONCES aparece allí sin recargar, los recuentos cambian en uno Y sigue allí al recargar', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US2-1 arrastre'))
    await signIn(page, member)
    await openBoard(page)
    const before = await counts(page)

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/v1/tasks/${task.id}/status`),
    )
    await drag(
      cardIn(column(page, 'pending'), task.title),
      column(page, 'in_progress'),
    )

    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
    await expect(titleLink(column(page, 'pending'), task.title)).toHaveCount(0)
    await expect
      .poll(() => headerCount(page, 'pending'))
      .toBe(before.pending - 1)
    await expect
      .poll(() => headerCount(page, 'in_progress'))
      .toBe(before.in_progress + 1)
    await expect(
      page.locator('[role="status"]', {
        hasText: `«${task.title}» está ahora en «En curso».`,
      }),
    ).toHaveCount(1)

    expect((await saved).ok()).toBe(true)
    await page.reload()
    await expect(page.getByRole('region')).toHaveCount(3)
    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
  })

  test('US2-2 · DADO solo el teclado y el foco en una tarjeta de «En curso», CUANDO elige «Hecho» en su control, ENTONCES pasa a «Hecho», los recuentos cambian Y el foco sigue en esa tarjeta', async ({
    page,
    request,
  }) => {
    const prefix = unique('US2-2')
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, `${prefix} teclado`)
    await setTaskStatus(request, member, task.id, 'in_progress')
    await scopeBoardTo(page, prefix)
    await signIn(page, member)
    await openBoard(page)
    const before = await counts(page)

    const control = statusControl(column(page, 'in_progress'), task.title)
    await pressUntilFocused(page, control)
    await control.selectOption('done')

    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()
    await expect
      .poll(() => headerCount(page, 'in_progress'))
      .toBe(before.in_progress - 1)
    await expect.poll(() => headerCount(page, 'done')).toBe(before.done + 1)
    await expect(statusControl(column(page, 'done'), task.title)).toBeFocused()
  })

  test('US2-3 · DADO cualquier tarjeta, CUANDO usa su control de estado, ENTONCES es el de la lista: solo tres estados y ≤ 2 interacciones, sin confirmación', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US2-3 control'))
    await signIn(page, member)
    let dialogs = 0
    page.on('dialog', (dialog) => {
      dialogs += 1
      void dialog.dismiss()
    })

    await page.goto('/tasks')
    await expect(statusControl(page, task.title)).toBeVisible()

    await openBoard(page)
    const control = statusControl(
      cardIn(column(page, 'pending'), task.title),
      task.title,
    )
    await expect(control.locator('option')).toHaveText([
      'Pendiente',
      'En curso',
      'Hecho',
    ])
    await control.selectOption('in_progress')

    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
    await expect(statusControl(page, task.title)).toHaveValue('in_progress')
    expect(dialogs).toBe(0)
  })

  test('US2-4 · DADO una tarjeta propia o ajena, CUANDO la mueve a cualquiera de las otras dos columnas, ENTONCES se acepta, incluidas las vueltas desde «Hecho» y el salto de «Pendiente» a «Hecho»', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Tablero')
    const ana = await signUp(request, 'Ana Tablero')
    const foreign = await createTask(request, ana, unique('US2-4 ajena'))
    const own = await createTask(request, oscar, unique('US2-4 propia'))
    await setTaskStatus(request, oscar, own.id, 'done')
    await signIn(page, oscar)
    await openBoard(page)

    const savedForeign = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/v1/tasks/${foreign.id}/status`),
    )
    await drag(
      cardIn(column(page, 'pending'), foreign.title),
      column(page, 'done'),
    )
    await expect(titleLink(column(page, 'done'), foreign.title)).toBeVisible()
    expect((await savedForeign).ok()).toBe(true)

    const savedOwn = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/v1/tasks/${own.id}/status`),
    )
    await statusControl(column(page, 'done'), own.title).selectOption('pending')
    await expect(titleLink(column(page, 'pending'), own.title)).toBeVisible()
    expect((await savedOwn).ok()).toBe(true)

    await page.reload()
    await expect(page.getByRole('region')).toHaveCount(3)
    await expect(titleLink(column(page, 'done'), foreign.title)).toBeVisible()
    await expect(titleLink(column(page, 'pending'), own.title)).toBeVisible()
  })

  test('US2-5 · DADO una tarjeta que se mueve, CUANDO el cambio no se guarda, ENTONCES vuelve a su columna, los recuentos vuelven Y sale un mensaje que dice que no se ha guardado', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US2-5 falla'))
    await signIn(page, member)
    await openBoard(page)
    const before = await counts(page)

    const rejections: [(route: Route) => Promise<void>, string][] = [
      [
        serverError,
        'No se ha guardado el cambio. Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.',
      ],
      [
        (route) =>
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              errors: [{ message: 'Unauthorized access' }],
            }),
          }),
        'No se ha guardado el cambio. Tu sesión ha caducado. Vuelve a iniciar sesión.',
      ],
      [
        (route) => route.abort(),
        'No se ha guardado el cambio. No se pudo conectar con el servidor. Comprueba que el backend está arrancado.',
      ],
    ]

    for (const [respond, message] of rejections) {
      await interceptStatusChanges(page, respond)
      await drag(
        cardIn(column(page, 'pending'), task.title),
        column(page, 'in_progress'),
      )

      await expect(statusError(page, task.id)).toHaveText(message)
      await expect(titleLink(column(page, 'pending'), task.title)).toBeVisible()
      await expect(
        titleLink(column(page, 'in_progress'), task.title),
      ).toHaveCount(0)
      expect(await counts(page)).toEqual(before)
    }
    await expect(
      page.locator('[role="status"]', {
        hasText: `No se ha guardado el cambio: «${task.title}» vuelve a «Pendiente».`,
      }),
    ).toHaveCount(1)
  })

  test('US2-6 · DADO una tarea borrada por otra persona, CUANDO mueve su tarjeta, ENTONCES no se muestra movida Y el mensaje dice que ya no existe, distinto del de conexión', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US2-6 borrada'))
    await signIn(page, member)
    await openBoard(page)
    await interceptStatusChanges(page, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ errors: [{ message: 'Row not found' }] }),
      }),
    )

    await statusControl(page, task.title).selectOption('in_progress')

    await expect(statusError(page, task.id)).toContainText(
      'Esta tarea ya no existe',
    )
    await expect(statusError(page, task.id)).not.toContainText(
      'Algo ha ido mal',
    )
    await expect(titleLink(column(page, 'pending'), task.title)).toBeVisible()
    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toHaveCount(0)
  })

  test('US2-7 · DADO una tarjeta que se arrastra, CUANDO la suelta en su misma columna o fuera de cualquier columna, ENTONCES queda donde estaba sin mensaje', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US2-7 quieta'))
    await signIn(page, member)
    let patches = 0
    page.on('request', (sent) => {
      if (sent.method() === 'PATCH' && sent.url().includes('/status'))
        patches += 1
    })
    await openBoard(page)

    await drag(
      cardIn(column(page, 'pending'), task.title),
      column(page, 'pending'),
    )
    await drag(
      cardIn(column(page, 'pending'), task.title),
      page.getByRole('heading', { name: 'Tablero', level: 1 }),
    )

    expect(patches).toBe(0)
    await expect(titleLink(column(page, 'pending'), task.title)).toBeVisible()
    await expect(statusError(page, task.id)).toHaveCount(0)
    await expect(page.getByText('No se ha guardado el cambio')).toHaveCount(0)
  })

  test('US2-8 · DADO una tarjeta que se mueve, CUANDO se ve el cambio, ENTONCES conserva título y responsable, las demás no cambian Y ocupa el sitio que le toca por orden', async ({
    page,
    request,
  }) => {
    const prefix = unique('US2-8')
    const member = await signUp(request, 'Berta Orden')
    const a = await createTask(request, member, `${prefix} A`)
    const b = await createTask(request, member, `${prefix} B`)
    const c = await createTask(request, member, `${prefix} C`)
    await setTaskStatus(request, member, a.id, 'in_progress')
    await setTaskStatus(request, member, c.id, 'in_progress')
    await scopeBoardTo(page, prefix)
    await signIn(page, member)
    await openBoard(page)

    const target = column(page, 'in_progress')
    const box = await target.boundingBox()
    await cardIn(column(page, 'pending'), b.title).dragTo(target, {
      sourcePosition: { x: 10, y: 10 },
      targetPosition: { x: 16, y: box!.height - 8 },
    })

    await expect(target.getByRole('listitem').getByRole('link')).toHaveText([
      c.title,
      b.title,
      a.title,
    ])
    const moved = cardIn(target, b.title)
    await expect(moved.getByText('Berta Orden', { exact: true })).toBeVisible()
    await expect(titleLink(target, a.title)).toBeVisible()
    await expect(titleLink(target, c.title)).toBeVisible()
  })

  test('US2-9 · DADO una tarea pasada a «Hecho» en el tablero, CUANDO vuelve a la lista, ENTONCES no está en la vista por defecto y sí al filtrar por «Hecho»', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('US2-9 a hecho'))
    const stays = await createTask(request, member, unique('US2-9 se queda'))
    await signIn(page, member)
    await openBoard(page)

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/v1/tasks/${task.id}/status`),
    )
    await statusControl(page, task.title).selectOption('done')
    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()
    expect((await saved).ok()).toBe(true)

    await page.getByRole('link', { name: 'Lista', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()
    await expect(titleLink(page, stays.title)).toBeVisible()
    await expect(titleLink(page, task.title)).toHaveCount(0)

    await page
      .getByRole('group', { name: 'Filtrar por estado' })
      .getByRole('button', { name: 'Hecho' })
      .click()
    await expect(titleLink(page, task.title)).toBeVisible()
  })

  test('Caso límite · mover dos veces seguidas la misma tarjeta deja la última elección, en pantalla y guardada', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('Caso límite'))
    await signIn(page, member)
    await openBoard(page)

    const held = gate()
    let patches = 0
    let answered = 0
    page.on('response', (response) => {
      if (
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/v1/tasks/${task.id}/status`)
      )
        answered += 1
    })
    await interceptStatusChanges(page, async (route) => {
      patches += 1
      if (patches === 1) await held.opened
      await route.continue()
    })

    await statusControl(page, task.title).selectOption('in_progress')
    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
    await expect.poll(() => patches).toBe(1)
    await statusControl(page, task.title).selectOption('done')
    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()

    held.open()
    await expect.poll(() => answered).toBe(2)
    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()

    await page.reload()
    await expect(page.getByRole('region')).toHaveCount(3)
    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()
  })
})

test.describe('US3 · columnas vacías y pantallas estrechas', () => {
  test('US3-1 · DADO un espacio sin tareas en «En curso», CUANDO abre el tablero, ENTONCES esa columna muestra 0 y un mensaje de vacía', async ({
    page,
    request,
  }) => {
    const prefix = unique('US3-1')
    const member = await signUp(request, 'Oscar Tablero')
    await createTask(request, member, `${prefix} pendiente`)
    const finished = await createTask(request, member, `${prefix} hecha`)
    await setTaskStatus(request, member, finished.id, 'done')
    await scopeBoardTo(page, prefix)
    await signIn(page, member)

    await openBoard(page)

    const ongoing = page.getByRole('region', { name: 'En curso (0 tareas)' })
    await expect(ongoing).toBeVisible()
    await expect(ongoing).toContainText('No hay tareas en este estado.')
    await expect(ongoing.getByRole('list')).toHaveCount(0)
  })

  test('US3-2 · DADO una columna con una sola tarjeta, CUANDO la mueve, ENTONCES la columna muestra su vacía en el acto Y si el cambio no se guarda el mensaje desaparece', async ({
    page,
    request,
  }) => {
    const prefix = unique('US3-2')
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, `${prefix} única`)
    await scopeBoardTo(page, prefix)
    await signIn(page, member)
    await openBoard(page)
    const empty = 'No hay tareas en este estado.'

    // Se va la única de «Pendiente»: su vacía aparece en el acto.
    await statusControl(page, task.title).selectOption('in_progress')
    await expect(column(page, 'pending')).toContainText(empty)
    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
    await expect(column(page, 'in_progress')).not.toContainText(empty)

    // Ahora es la única de «En curso»; el cambio falla tras verse la vacía.
    const held = gate()
    await interceptStatusChanges(page, async (route) => {
      await held.opened
      await serverError(route)
    })
    await statusControl(page, task.title).selectOption('done')
    await expect(column(page, 'in_progress')).toContainText(empty)
    await expect(titleLink(column(page, 'done'), task.title)).toBeVisible()

    held.open()
    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
    await expect(column(page, 'in_progress')).not.toContainText(empty)
    await expect(column(page, 'done')).toContainText(empty)
  })

  test('US3-3 · DADO una columna vacía, CUANDO mueve una tarjeta a ella, ENTONCES el mensaje desaparece y se ve la tarjeta', async ({
    page,
    request,
  }) => {
    const prefix = unique('US3-3')
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, `${prefix} a la vacía`)
    await scopeBoardTo(page, prefix)
    await signIn(page, member)
    await openBoard(page)
    const ongoing = page.getByRole('region', { name: 'En curso (0 tareas)' })
    await expect(ongoing).toContainText('No hay tareas en este estado.')

    await drag(cardIn(column(page, 'pending'), task.title), ongoing)

    const filled = column(page, 'in_progress')
    await expect(titleLink(filled, task.title)).toBeVisible()
    await expect(filled).not.toContainText('No hay tareas en este estado.')
    await expect(filled).toHaveAccessibleName('En curso (1 tarea)')
  })

  test('US3-4 · DADO un espacio sin ninguna tarea, CUANDO abre el tablero, ENTONCES ve las tres columnas vacías y la indicación de crear desde la lista, con forma de ir', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    await scopeBoardTo(page, unique('US3-4 nada'))
    await signIn(page, member)

    await openBoard(page)

    for (const status of STATUSES) {
      await expect(
        page.getByRole('region', { name: `${LABELS[status]} (0 tareas)` }),
      ).toContainText('No hay tareas en este estado.')
    }
    await expect(page.getByText('Todavía no hay tareas')).toBeVisible()
    await expect(
      page.getByText('Las tareas se crean desde la lista.'),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Ir a la lista' }).click()
    await expect(page).toHaveURL(/\/tasks$/)
  })

  test('US3-5 · DADO una pantalla estrecha, CUANDO abre el tablero, ENTONCES las columnas se apilan en orden con su recuento Y la página no se desplaza en horizontal', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const long = await createTask(
      request,
      member,
      unique(`US3-5 ${'Supercalifragilisticoespialidoso'.repeat(4)}`),
    )
    await signIn(page, member)
    await page.setViewportSize({ width: 320, height: 800 })

    await openBoard(page)
    await expect(titleLink(column(page, 'pending'), long.title)).toBeVisible()

    const boxes = []
    for (const status of STATUSES) {
      const region = column(page, status)
      await expect(region.getByRole('heading', { level: 2 })).toContainText(
        /\(\d+ tareas?\)/,
      )
      boxes.push((await region.boundingBox())!)
    }
    expect(boxes[1].x).toBe(boxes[0].x)
    expect(boxes[2].x).toBe(boxes[0].x)
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y)
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y)
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('US3-6 · DADO una pantalla estrecha, CUANDO cambia el estado de una tarjeta con su control, ENTONCES pasa a su nueva columna y el foco sigue en ella', async ({
    page,
    request,
  }) => {
    const prefix = unique('US3-6')
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, `${prefix} estrecha`)
    await scopeBoardTo(page, prefix)
    await signIn(page, member)
    await page.setViewportSize({ width: 320, height: 800 })
    await openBoard(page)

    const control = statusControl(column(page, 'pending'), task.title)
    await pressUntilFocused(page, control)
    await control.selectOption('in_progress')

    await expect(
      titleLink(column(page, 'in_progress'), task.title),
    ).toBeVisible()
    await expect(
      statusControl(column(page, 'in_progress'), task.title),
    ).toBeFocused()
  })

  test('US3-7 · DADO un tablero cargando, con error de carga o con columnas vacías, CUANDO lo mira, ENTONCES cada situación se ve distinta', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    await signIn(page, member)
    const loading = page.getByText('Cargando el tablero…')
    const boardTitle = page.getByRole('heading', { name: 'Tablero', level: 1 })

    // Cargando: la respuesta no llega hasta que el test la suelta.
    const held = gate()
    await page.route(isTasksByStatusUrl, async (route) => {
      await held.opened
      await route.fallback()
    })
    await page.goto('/tasks/board')
    await expect(boardTitle).toBeVisible()
    await expect(loading).toBeVisible()
    await expect(page.getByRole('region')).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    held.open()
    await page.unroute(isTasksByStatusUrl)

    // Error de carga.
    await page.route(isTasksByStatusUrl, serverError)
    await page.goto('/tasks/board')
    await expect(boardTitle).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(
      'No se ha podido cargar el tablero',
    )
    await expect(page.getByRole('region')).toHaveCount(0)
    await expect(loading).toHaveCount(0)
    await page.unroute(isTasksByStatusUrl)

    // Columnas vacías.
    await scopeBoardTo(page, unique('US3-7 nada'))
    await page.goto('/tasks/board')
    await expect(boardTitle).toBeVisible()
    await expect(page.getByRole('region')).toHaveCount(3)
    await expect(page.getByText('No hay tareas en este estado.')).toHaveCount(3)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(loading).toHaveCount(0)
  })

  test('SC-007 · el tablero no tiene violaciones graves ni críticas de accesibilidad con tareas, con columnas vacías y con un cambio fallido', async ({
    page,
    request,
  }) => {
    const member = await signUp(request, 'Oscar Tablero')
    const task = await createTask(request, member, unique('SC-007'))
    await signIn(page, member)

    // Con tareas.
    await openBoard(page)
    await expectNoSeriousA11yViolations(page)

    // Con un cambio fallido.
    await interceptStatusChanges(page, serverError)
    await statusControl(page, task.title).selectOption('in_progress')
    await expect(statusError(page, task.id)).toContainText(
      'No se ha guardado el cambio.',
    )
    await expectNoSeriousA11yViolations(page)

    // Con columnas vacías.
    await scopeBoardTo(page, unique('SC-007 nada'))
    await openBoard(page)
    await expect(page.getByText('No hay tareas en este estado.')).toHaveCount(3)
    await expectNoSeriousA11yViolations(page)
  })
})
