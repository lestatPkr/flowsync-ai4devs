import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createTask,
  deleteTask,
  expectNoSeriousA11yViolations,
  getTaskStatus,
  logOut,
  setTaskDueDate,
  signIn,
  signUp,
} from './support'

/**
 * La matriz de borrar una tarea (specs/007-borrar-tarea, contracts/delete-task-ui.md):
 * un test por escenario de interfaz, contra el backend real. La BD es
 * compartida, así que cada test crea sus miembros y tareas con títulos únicos.
 *
 * El diálogo nace desarmado durante 500 ms (la guarda contra la doble
 * activación): el reloj de la página se instala antes de cada test, se «arma»
 * con `page.clock.fastForward(500)` antes de toda activación deliberada y se
 * pausa con `page.clock.pauseAt(...)` donde lo que se prueba es la guarda.
 */

const unique = (label: string) =>
  `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const DESCRIPTION =
  'Se borrará para todo el equipo y no se podrá recuperar: no hay papelera ni forma de deshacerlo.'
const FAILED_MESSAGE =
  'No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.'
const SESSION_EXPIRED = 'Tu sesión ha caducado. Vuelve a iniciar sesión.'

const deleteButton = (page: Page) =>
  page.getByRole('button', { name: 'Borrar tarea' })

const dialog = (page: Page) => page.getByRole('dialog')

const cancelButton = (page: Page) =>
  dialog(page).getByRole('button', { name: 'Cancelar' })

const confirmButton = (page: Page) =>
  dialog(page).getByRole('button', { name: 'Borrar definitivamente' })

const taskHeading = (page: Page, title: string) =>
  page.getByRole('heading', { level: 1, name: title })

const taskLink = (page: Page, title: string) =>
  page.getByRole('link', { name: title, exact: true })

const deletedNotice = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Se ha borrado' })

const statusControl = (page: Page, title: string) =>
  page.getByRole('combobox', { name: `Estado de «${title}»` })

/** Cuenta las peticiones `DELETE` que salen de la página desde ahora. */
function countDeletes(page: Page) {
  let count = 0
  page.on('request', (request) => {
    if (request.method() === 'DELETE') count += 1
  })
  return () => count
}

/**
 * Las peticiones a esa tarea (los manejadores dejan pasar todo lo que no es
 * `DELETE`). Se guarda en una constante: `page.unroute` compara el matcher por
 * identidad, y uno recién creado no quitaría la ruta.
 */
const isDeleteOf = (taskId: number) => (url: URL) =>
  url.pathname === `/api/v1/tasks/${taskId}`

async function openTask(page: Page, task: { id: number; title: string }) {
  await page.goto(`/tasks/${task.id}`)
  await expect(taskHeading(page, task.title)).toBeVisible()
}

/** Pide borrar con el ratón: «Borrar tarea» tiene que estar a la vista. */
async function askToDelete(page: Page) {
  await expect(deleteButton(page)).toBeVisible()
  await deleteButton(page).click()
  await expect(dialog(page)).toBeVisible()
}

/** Deja pasar la guarda de 500 ms: a partir de aquí el diálogo atiende. */
const arm = (page: Page) => page.clock.fastForward(500)

/** Para el reloj: la guarda no caduca mientras dura el gesto. */
async function pauseClock(page: Page) {
  const now = await page.evaluate(() => Date.now())
  await page.clock.pauseAt(now + 10)
}

/** Pulsa `key` hasta que `target` tiene el foco (o falla tras `max` pulsaciones). */
async function pressUntilFocused(
  page: Page,
  target: Locator,
  key: 'Tab' | 'Shift+Tab' = 'Tab',
  max = 40,
) {
  await expect(target).toBeVisible()
  for (let step = 0; step < max; step += 1) {
    await page.keyboard.press(key)
    if (await target.evaluate((element) => element === document.activeElement))
      return
  }
  await expect(target).toBeFocused()
}

const isFocusVisible = (target: Locator) =>
  target.evaluate((element) => element.matches(':focus-visible'))

/** Lo que se ve de la tarea abierta: título, responsable, estado y fecha. */
const taskDetails = (page: Page) => page.locator('dl')

test.beforeEach(async ({ page }) => {
  await page.clock.install()
})

test.describe('US1 · borrar una tarea, propia o ajena, confirmando que no hay vuelta atrás', () => {
  test('US1-1 · DADO un miembro sobre una tarea existente, CUANDO pide borrarla y confirma, ENTONCES desaparece de su vista sin recargar y deja de aparecer en la lista y en el tablero', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const witness = await createTask(request, oscar, unique('Se queda'))
    const task = await createTask(request, oscar, unique('Para borrar'))
    await signIn(page, oscar)

    await page.goto('/tasks')
    await taskLink(page, task.title).click()
    await expect(taskHeading(page, task.title)).toBeVisible()
    await askToDelete(page)
    await arm(page)
    await page.evaluate(() => {
      ;(window as unknown as { notReloaded: boolean }).notReloaded = true
    })
    await confirmButton(page).click()

    await expect(taskHeading(page, task.title)).toBeHidden({ timeout: 1_000 })
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(taskLink(page, witness.title)).toBeVisible()
    await expect(taskLink(page, task.title)).toHaveCount(0)
    expect(
      await page.evaluate(
        () => (window as unknown as { notReloaded?: boolean }).notReloaded,
      ),
    ).toBe(true)

    await page.getByRole('link', { name: 'Tablero' }).click()
    await expect(page.getByRole('link', { name: witness.title })).toBeVisible()
    await expect(page.getByRole('link', { name: task.title })).toHaveCount(0)
    expect(await getTaskStatus(request, oscar, task.id)).toBe(404)
  })

  test('US1-2 · DADO que un miembro ha borrado una tarea, CUANDO otra persona del equipo carga la lista o el tablero, ENTONCES esa tarea tampoco está para ella', async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const ana = await signUp(request, 'Ana Mira')
    const witness = await createTask(request, oscar, unique('Se queda'))
    const task = await createTask(request, oscar, unique('Para borrar'))
    await signIn(page, oscar)

    await openTask(page, task)
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()
    await expect(deletedNotice(page)).toBeVisible()

    const anaContext = await browser.newContext()
    const anaPage = await anaContext.newPage()
    await signIn(anaPage, ana)
    await anaPage.goto(`${baseURL}/tasks`)
    await expect(taskLink(anaPage, witness.title)).toBeVisible()
    await expect(taskLink(anaPage, task.title)).toHaveCount(0)
    await anaPage.goto(`${baseURL}/tasks/board`)
    await expect(
      anaPage.getByRole('link', { name: witness.title }),
    ).toBeVisible()
    await expect(anaPage.getByRole('link', { name: task.title })).toHaveCount(0)
    await anaContext.close()
  })

  test('US1-3 · DADO una tarea que creó y lleva otra persona, CUANDO un miembro la borra y confirma, ENTONCES se borra igual que una propia, sin permiso especial ni advertencia por ser ajena', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const ana = await signUp(request, unique('Ana Dueña'))
    const task = await createTask(request, ana, unique('Revisar contrato'))
    await signIn(page, oscar)

    await openTask(page, task)
    await askToDelete(page)

    await expect(dialog(page)).toHaveAccessibleName(`¿Borrar «${task.title}»?`)
    await expect(dialog(page)).toHaveAccessibleDescription(DESCRIPTION)
    await expect(dialog(page)).not.toContainText(ana.fullName)
    await expect(dialog(page)).not.toContainText('Ana')
    await expect(dialog(page)).not.toContainText(/ajena/i)

    await arm(page)
    await confirmButton(page).click()
    await expect(deletedNotice(page)).toBeVisible()
    expect(await getTaskStatus(request, ana, task.id)).toBe(404)
  })

  test('US1-4 · DADO un miembro que pide borrar una tarea, CUANDO el producto le responde, ENTONCES antes de borrar nada le pide confirmar en una pregunta que bloquea el resto de la pantalla', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const task = await createTask(request, oscar, unique('Para borrar'))
    await signIn(page, oscar)
    const deletes = countDeletes(page)

    await openTask(page, task)
    await askToDelete(page)

    await expect(dialog(page)).toBeVisible()
    expect(
      await dialog(page).evaluate((element) => element.matches(':modal')),
    ).toBe(true)
    expect(deletes()).toBe(0)
  })

  test('US1-5 · DADO un miembro al que se le pide confirmar un borrado, CUANDO lee la pregunta, ENTONCES ve el título de la tarea y entiende que después no se podrá recuperar', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const title = `${unique('Título largo')} ${'x'.repeat(200)}`.slice(0, 200)
    const task = await createTask(request, oscar, title)
    await signIn(page, oscar)

    await openTask(page, task)
    await askToDelete(page)

    expect(task.title).toHaveLength(200)
    await expect(dialog(page)).toHaveAccessibleName(`¿Borrar «${task.title}»?`)
    await expect(dialog(page)).toHaveAccessibleDescription(
      /no se podrá recuperar/,
    )
  })

  test('US1-6 · DADO un miembro al que se le pide confirmar un borrado, CUANDO mira las opciones, ENTONCES la que borra dice lo que hace y se distingue como destructiva, y la que no borra es igual de visible', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const task = await createTask(request, oscar, unique('Para borrar'))
    await signIn(page, oscar)

    await openTask(page, task)
    await askToDelete(page)

    await expect(confirmButton(page)).toBeVisible()
    await expect(confirmButton(page)).toHaveAttribute(
      'data-variant',
      'destructive',
    )
    await expect(cancelButton(page)).toBeVisible()
    const confirmBox = await confirmButton(page).boundingBox()
    const cancelBox = await cancelButton(page).boundingBox()
    expect(confirmBox?.height).toBeGreaterThan(0)
    expect(cancelBox?.height).toBe(confirmBox?.height)
    await expect(page.getByRole('button', { name: 'Aceptar' })).toHaveCount(0)
  })

  test('US1-7 · DADO un miembro que acaba de confirmar un borrado, CUANDO se completa, ENTONCES se le indica brevemente que se ha borrado, sin ofrecer deshacer', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const task = await createTask(request, oscar, unique('Para borrar'))
    await signIn(page, oscar)

    await openTask(page, task)
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()

    await expect(deletedNotice(page)).toHaveText(
      `Se ha borrado «${task.title}».`,
    )
    await expect(deletedNotice(page)).toBeFocused()
    await expect(page.getByRole('button', { name: /deshacer/i })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /deshacer/i })).toHaveCount(0)

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Tareas', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Se ha borrado')).toHaveCount(0)
  })

  test('US1-8 · DADO un borrado confirmado que no llega a completarse por un fallo de conexión, CUANDO el miembro mira la pantalla, ENTONCES la tarea sigue, se le explica que no se ha podido borrar y nunca se le presentó como borrada', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Borra')
    const ana = await signUp(request, 'Ana Mira')
    const task = await createTask(request, oscar, unique('No se borra'))
    await signIn(page, oscar)

    await openTask(page, task)
    const taskUrl = isDeleteOf(task.id)
    await page.route(taskUrl, (route) =>
      route.request().method() === 'DELETE' ? route.abort() : route.fallback(),
    )
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()

    await expect(dialog(page).getByRole('alert')).toHaveText(FAILED_MESSAGE)
    await expect(dialog(page)).toBeVisible()
    await cancelButton(page).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(taskHeading(page, task.title)).toBeVisible()
    expect(await getTaskStatus(request, ana, task.id)).toBe(200)
    await expect(page.getByText('Se ha borrado')).toHaveCount(0)

    // Un fallo del servidor tampoco borra ni enseña el error crudo (FR-007).
    await page.unroute(taskUrl)
    await page.route(taskUrl, (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({
            status: 500,
            json: { errors: [{ message: 'Internal Server Error' }] },
          })
        : route.fallback(),
    )
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()

    await expect(dialog(page).getByRole('alert')).toHaveText(FAILED_MESSAGE)
    await expect(page.getByText('Internal Server Error')).toHaveCount(0)
    await expect(taskHeading(page, task.title)).toBeVisible()
    expect(await getTaskStatus(request, ana, task.id)).toBe(200)
    await expect(page.getByText('Se ha borrado')).toHaveCount(0)
  })
})

test.describe('US2 · los guardarraíles: nada se borra sin querer', () => {
  test('US2-1 · DADO un miembro al que se le pide confirmar un borrado, CUANDO cancela con la opción de cancelar, con Escape o con un clic fuera, ENTONCES la tarea sigue igual, la pregunta se cierra y el foco vuelve a donde estaba', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Cancela')
    const task = await createTask(request, oscar, unique('Se queda igual'))
    await setTaskDueDate(request, oscar, task.id, '2030-01-15')
    await signIn(page, oscar)
    const deletes = countDeletes(page)

    await openTask(page, task)
    const before = await taskDetails(page).innerText()

    const cancellations: ((page: Page) => Promise<void>)[] = [
      (page) => cancelButton(page).click(),
      (page) => page.keyboard.press('Escape'),
      (page) => page.mouse.click(5, 5),
    ]
    for (const cancel of cancellations) {
      await askToDelete(page)
      await arm(page)
      await cancel(page)

      await expect(dialog(page)).toHaveCount(0)
      await expect(deleteButton(page)).toBeFocused()
      expect(await taskDetails(page).innerText()).toBe(before)
      await expect(taskHeading(page, task.title)).toBeVisible()
    }

    expect(deletes()).toBe(0)
    expect(await getTaskStatus(request, oscar, task.id)).toBe(200)
  })

  test('US2-2 · DADO que se acaba de abrir la pregunta de confirmación, CUANDO el miembro pulsa Enter sin moverse de donde la pregunta deja el foco, ENTONCES no se borra nada', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Enter')
    const task = await createTask(request, oscar, unique('Enter no borra'))
    await signIn(page, oscar)
    const deletes = countDeletes(page)

    await openTask(page, task)
    await expect(deleteButton(page)).toBeVisible()
    await pauseClock(page)
    await deleteButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await expect(cancelButton(page)).toBeFocused()
    await page.keyboard.press('Enter')

    expect(deletes()).toBe(0)
    await expect(taskHeading(page, task.title)).toBeVisible()
    expect(await getTaskStatus(request, oscar, task.id)).toBe(200)
  })

  test('US2-3 · DADO un miembro que pide borrar con un doble clic o pulsando dos veces la tecla, CUANDO se completa el gesto, ENTONCES la tarea no se ha borrado y la pregunta sigue abierta', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Doble')
    const task = await createTask(request, oscar, unique('Doble no borra'))
    await signIn(page, oscar)
    const deletes = countDeletes(page)

    await openTask(page, task)
    await expect(deleteButton(page)).toBeVisible()
    await pauseClock(page)

    await deleteButton(page).dblclick()
    await expect(dialog(page)).toBeVisible()
    expect(deletes()).toBe(0)

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(deleteButton(page)).toBeFocused()

    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    expect(deletes()).toBe(0)
    expect(await getTaskStatus(request, oscar, task.id)).toBe(200)
  })

  test('US2-4 · DADO un miembro en la lista o en el tablero, CUANDO compara lo que cuesta borrar con lo que cuesta cambiar el estado, ENTONCES borrar cuesta más y no comparte control ni posición con el estado', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Compara')
    const task = await createTask(request, oscar, unique('Cuesta más'))
    await signIn(page, oscar)

    await page.goto('/tasks')
    await expect(taskLink(page, task.title)).toBeVisible()
    await expect(statusControl(page, task.title)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Borrar/ })).toHaveCount(0)

    await page.goto('/tasks/board')
    await expect(page.getByRole('link', { name: task.title })).toBeVisible()
    await expect(statusControl(page, task.title)).toBeVisible()
    await expect(page.getByRole('button', { name: /^Borrar/ })).toHaveCount(0)

    // Borrar exige abrir la tarea: la tercera interacción.
    await page.getByRole('link', { name: task.title }).click()
    await expect(taskHeading(page, task.title)).toBeVisible()
    await expect(deleteButton(page)).toBeVisible()
  })

  test('US2-5 · DADO una persona sin sesión o con la sesión ya cerrada, CUANDO intenta borrar una tarea, ENTONCES no se borra nada y la tarea sigue para todo el equipo', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Sesión')
    const ana = await signUp(request, 'Ana Mira')
    const task = await createTask(request, oscar, unique('Sin sesión'))

    // (a) Sin sesión: la tarea no se abre y no hay «Borrar tarea».
    await page.goto(`/tasks/${task.id}`)
    await expect(page).toHaveURL(/\/login$/)
    await expect(deleteButton(page)).toHaveCount(0)

    // (b) Con la sesión cerrada mientras la pregunta está abierta.
    await signIn(page, oscar)
    await openTask(page, task)
    await askToDelete(page)
    await logOut(request, oscar)
    await arm(page)
    await confirmButton(page).click()

    await expect(dialog(page).getByRole('alert')).toHaveText(SESSION_EXPIRED)
    expect(await getTaskStatus(request, ana, task.id)).toBe(200)
  })

  test('US2-6 · DADO que otra persona ya ha borrado una tarea que un miembro tenía a la vista, CUANDO el miembro intenta borrarla y confirma, ENTONCES se le dice que ya no existe, sin presentarlo como un fallo, y deja de mostrarse', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Tarde')
    const ana = await signUp(request, 'Ana Primero')
    const task = await createTask(request, oscar, unique('Ya borrada'))
    await signIn(page, oscar)

    await openTask(page, task)
    await deleteTask(request, ana, task.id)
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()

    const notFound = page
      .getByRole('alert')
      .filter({ hasText: 'Esta tarea ya no existe' })
    await expect(notFound).toBeVisible()
    await expect(notFound).toContainText('Puede que alguien la haya borrado.')
    await expect(notFound).not.toHaveClass(/text-destructive/)
    await expect(page.getByText('Algo ha ido mal')).toHaveCount(0)
    await expect(dialog(page)).toHaveCount(0)
    await expect(taskHeading(page, task.title)).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Volver a la lista' }),
    ).toBeFocused()
  })

  test('US2-7 · DADO un miembro que quiere quitar de la vista una tarea terminada, CUANDO usa el estado «Hecho», ENTONCES sale de la vista por defecto pero sigue consultable, y ese camino no pide confirmación ni destruye nada', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Hecho')
    const task = await createTask(request, oscar, unique('Terminada'))
    await signIn(page, oscar)
    const deletes = countDeletes(page)

    await page.goto('/tasks')
    await expect(taskLink(page, task.title)).toBeVisible()
    await statusControl(page, task.title).selectOption('done')

    await expect(taskLink(page, task.title)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(deletes()).toBe(0)

    await page.getByRole('button', { name: 'Hecho', exact: true }).click()
    await expect(taskLink(page, task.title)).toBeVisible()
    await taskLink(page, task.title).click()
    await expect(taskHeading(page, task.title)).toBeVisible()
    // Abierta, ofrece el otro camino: borrar.
    await expect(deleteButton(page)).toBeVisible()
    expect(await getTaskStatus(request, oscar, task.id)).toBe(200)
  })

  test('US2-8 · DADO un miembro que usa solo el teclado, CUANDO pide borrar, recorre la pregunta y la confirma o la cancela, ENTONCES hace todo el recorrido con el foco siempre visible y sin salir de la pregunta', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Teclado')
    const task = await createTask(request, oscar, unique('Con teclado'))
    await signIn(page, oscar)

    await page.goto('/tasks')
    await pressUntilFocused(page, taskLink(page, task.title))
    await page.keyboard.press('Enter')
    await expect(taskHeading(page, task.title)).toBeVisible()

    await pressUntilFocused(page, deleteButton(page))
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await expect(cancelButton(page)).toBeFocused()
    expect(await isFocusVisible(cancelButton(page))).toBe(true)

    await page.keyboard.press('Tab')
    await expect(confirmButton(page)).toBeFocused()
    expect(await isFocusVisible(confirmButton(page))).toBe(true)

    await page.keyboard.press('Tab')
    await expect(cancelButton(page)).toBeFocused()
    expect(await isFocusVisible(cancelButton(page))).toBe(true)

    await page.keyboard.press('Shift+Tab')
    await expect(confirmButton(page)).toBeFocused()
    expect(await isFocusVisible(confirmButton(page))).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(deleteButton(page)).toBeFocused()
    expect(await isFocusVisible(deleteButton(page))).toBe(true)

    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()
    await expect(cancelButton(page)).toBeFocused()
    await arm(page)
    await page.keyboard.press('Tab')
    await expect(confirmButton(page)).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/tasks$/)
    await expect(deletedNotice(page)).toBeFocused()
    expect(await getTaskStatus(request, oscar, task.id)).toBe(404)
  })

  test('A11Y · DADO el recorrido de borrar, CUANDO el diálogo está abierto, en error o el aviso de borrado está en la lista, ENTONCES no hay violaciones graves ni críticas de accesibilidad', async ({
    page,
    request,
  }) => {
    const oscar = await signUp(request, 'Oscar Accesible')
    const task = await createTask(request, oscar, unique('Accesible'))
    await signIn(page, oscar)

    await openTask(page, task)
    await askToDelete(page)
    await expectNoSeriousA11yViolations(page)

    const taskUrl = isDeleteOf(task.id)
    await page.route(taskUrl, (route) =>
      route.request().method() === 'DELETE' ? route.abort() : route.fallback(),
    )
    await arm(page)
    await confirmButton(page).click()
    await expect(dialog(page).getByRole('alert')).toHaveText(FAILED_MESSAGE)
    await expectNoSeriousA11yViolations(page)

    await page.unroute(taskUrl)
    await confirmButton(page).click()
    await expect(deletedNotice(page)).toBeVisible()
    await expectNoSeriousA11yViolations(page)
  })
})

test.describe('US3 · lo que pide el modelo de amenazas', () => {
  test('US3-4 · DADO la aplicación servida, CUANDO una página de otro sitio intenta mostrarla incrustada, ENTONCES el navegador se niega a mostrarla', async ({
    page,
    baseURL,
  }) => {
    // `setContent` espera al `load` de la página, que espera al del marco.
    await page.setContent(`<iframe src="${baseURL}/tasks"></iframe>`)
    const frame = page.frameLocator('iframe')

    // Si el marco cargara la SPA tendría su `#root` y, en seguida, un encabezado.
    await expect(frame.locator('#root')).toHaveCount(0)
    await expect(frame.getByRole('heading')).toHaveCount(0)
  })

  test('US3-5 · DADO un borrado, CUANDO el sistema responde, ENTONCES ningún mensaje de la interfaz dice quién borró la tarea', async ({
    page,
    request,
    browser,
    baseURL,
  }) => {
    const oscar = await signUp(request, unique('Oscar Anónimo'))
    const ana = await signUp(request, 'Ana Mira')
    const first = await createTask(request, ana, unique('Primera de Ana'))
    const second = await createTask(request, ana, unique('Segunda de Ana'))
    await signIn(page, oscar)

    // El aviso de quien borra no le nombra.
    await openTask(page, first)
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()
    await expect(deletedNotice(page)).toBeVisible()
    await expect(taskLink(page, second.title)).toBeVisible()
    await expect(page.locator('body')).not.toContainText(oscar.fullName)

    // Ana tiene abierta otra; Oscar la borra; Ana confirma la suya.
    const anaContext = await browser.newContext()
    const anaPage = await anaContext.newPage()
    await anaPage.clock.install()
    await signIn(anaPage, ana)
    await anaPage.goto(`${baseURL}/tasks/${second.id}`)
    await expect(taskHeading(anaPage, second.title)).toBeVisible()

    await openTask(page, second)
    await askToDelete(page)
    await arm(page)
    await confirmButton(page).click()
    await expect(deletedNotice(page)).toBeVisible()

    await askToDelete(anaPage)
    await arm(anaPage)
    await confirmButton(anaPage).click()
    await expect(
      anaPage.getByRole('alert').filter({ hasText: 'Esta tarea ya no existe' }),
    ).toBeVisible()
    await expect(anaPage.locator('body')).not.toContainText(oscar.fullName)
    await expect(anaPage.locator('body')).not.toContainText('Oscar')
    await anaContext.close()
  })
})
