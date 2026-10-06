---

description: "Task list for Tablero de tareas por estado"
---

# Tasks: Tablero de tareas por estado

**Input**: Design documents from `/specs/006-tablero/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/board-ui.md](./contracts/board-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos (principio II de la constitución **v1.2.0**: en el frontend, la Definition of Done de una historia de interfaz es su matriz e2e, escrita antes y vista en rojo). Dos ficheros nuevos de Playwright:

- `frontend/e2e/task-status-list.spec.ts` — **caracterización** del control de estado de la lista (4 tests), **verde antes y después** de extraer su reconciliación (Phase 2). Ninguna aserción cambia entre un run y otro.
- `frontend/e2e/board.spec.ts` — la **matriz del tablero**: un test por escenario de aceptación (11 de US1, 9 de US2, 7 de US3) más el caso límite de dos cambios seguidos y el axe de SC-007, cada uno titulado exactamente como en la [matriz del contrato](./contracts/board-ui.md#matriz-de-comportamiento-definition-of-done). Un `test.describe` por historia. **Los tres bloques se escriben y se corren en rojo antes de la primera línea de implementación** (Phase 3), porque la razón correcta del rojo es una sola —**la ruta `/tasks/board` todavía no existe**— y solo es cierta mientras la ruta no exista: si el bloque de US2 o US3 se escribiera después de US1, fallaría por otro motivo o, peor, algún test (p. ej. US3-5, la rejilla) nacería ya en verde sin haberse visto en rojo. Es además el orden de [research §13](./research.md#13-reparto-del-trabajo).

Ningún test existente se edita ni se borra (`smoke.spec.ts` igual). Backend: ningún endpoint cambia, sin matriz Japa nueva; `npm test` debe seguir en verde sin tocarse.

**Organization**: Tareas agrupadas por historia (US1/US2/US3 de `spec.md`) y en orden de dependencias: línea base → caracterización en verde → extracción de la reconciliación (refactor verde→verde) → helpers e2e → matriz del tablero en rojo, bloque a bloque por historia → US1 → US2 → US3 → valla y cierre. Cada tarea nombra **la capa y el archivo** que toca. Ninguna tarea rediseña lo que `plan.md`/`research.md`/`contracts/board-ui.md` ya decidieron: solo lo ejecuta, con los textos, ids y clases del contrato.

**Sin commits, push ni PR durante la implementación**: los commits los hace el humano tras la revisión. Donde research §13 sugiere un corte de commit, la tarea lo señala como «punto de commit (humano)».

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React), comandos ejecutados desde cada carpeta. **Este cambio vive entero en `frontend/`** (más dos viñetas en `DESIGN.md`). **No se tocan** (plan.md → Project Structure, BOUNDARIES.md): `backend/` entero, `frontend/src/auth/` (valla: el tablero solo **usa** `useAuth()`), `frontend/src/components/ui/` (generado por shadcn; se compone por fuera con `Card`, `Button`, `Alert`), los `package.json`/`package-lock.json` de ambos lados (**ninguna dependencia nueva**: ni dnd-kit ni similares), `frontend/src/index.css` (ningún token nuevo, research §10; ver la excepción condicional T034), `frontend/e2e/smoke.spec.ts`, `frontend/src/lib/types.ts` y las funciones existentes de `frontend/src/lib/api.ts` (`listTasks`, `updateTaskStatus`, `toApiError` y sus mensajes).

---

## Phase 1: Setup (línea base)

**Purpose**: Fijar el punto de partida para poder demostrar al final que nada fuera del alcance se movió y que nada se rompió.

- [X] T001 [Repo · verificación] Anotar el commit de partida (`git rev-parse HEAD`; hoy `38b6d89`) como **base de todos los diffs de la valla** (T036). Desde `backend/`: `npm test` en verde. Desde `frontend/`: `npx playwright install chromium` si falta, y `npm run lint`, `npm run build` y `npm run test:e2e` (hoy solo `smoke.spec.ts`) en verde. Anotar aquí el resultado (número de tests de cada suite) como línea base
  - **Base anotada**: `git rev-parse HEAD` = `6f4e793` (no `38b6d89`: entre los dos solo está el commit de `specs/006-tablero/`, sin código; se usa `6f4e793` como base de la valla). Backend `npm test`: **121 passed**. Frontend: `npm run lint` y `npm run build` en verde; `npm run test:e2e`: **2 passed** (`smoke.spec.ts`).

**Checkpoint**: Base anotada; backend y frontend en verde sin cambios.

---

## Phase 2: Foundational (Blocking Prerequisites) — la red antes del refactor y las piezas compartidas

**Purpose**: El tablero necesita que la reconciliación optimista de `TaskStatusSelect` viva **fuera del componente y por tarea**, porque al cambiar de columna React desmonta la tarjeta (research §2, plan → Complexity Tracking). Es un refactor de un comportamiento existente sin e2e propios: **primero se fija con caracterización (verde), luego se extrae, y la caracterización sigue en verde sin tocar ninguna aserción**. También aquí: `byListOrder` a `lib/` y los helpers e2e que usa la matriz.

**⚠️ CRITICAL**: Ninguna tarea de historia (Phase 3 en adelante) empieza hasta que T008 esté en verde.

- [X] T002 [Frontend · e2e caracterización] Crear `frontend/e2e/task-status-list.spec.ts` con los 4 tests de la [tabla de caracterización](./contracts/board-ui.md#tests-de-caracterización-de-la-lista), titulados exactamente: `Lista · cambiar el estado desde la fila se guarda y sigue así al recargar`; `Lista · pasar una tarea a «Hecho» la saca de la vista por defecto`; `Lista · si el cambio no se guarda, el control vuelve al estado anterior con el mensaje de lib/api.ts` (`page.route` de `PATCH **/api/v1/tasks/*/status` → `500`; el `<select>` vuelve al valor anterior y se ve «Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» **sin** el prefijo «No se ha guardado el cambio.»); `Lista · dos cambios seguidos acaban en el último elegido` (primer `PATCH` retenido con `page.route` hasta que el test lo suelta; dos `selectOption`; tras soltarlo y recargar, el estado guardado es el último elegido). Cada test da de alta su miembro con `signUp` y crea sus tareas con títulos únicos (`Date.now()` + aleatorio) con `createTask` de `frontend/e2e/support.ts`; el control se localiza por su `aria-label` «Estado de «{título}»». No tocar `smoke.spec.ts` — depende de T001
- [X] T003 [Frontend · verificación] Desde `frontend/`, `npx playwright test e2e/task-status-list.spec.ts` **en verde contra el código actual**, sin haber tocado `src/`. Si algún test sale en rojo, es que caracteriza mal: se corrige el test (ahora, antes del refactor), nunca el código. A partir de aquí `task-status-list.spec.ts` queda congelado — depende de T002
  - **Hecho**: 4/4 en verde contra el código sin tocar (`src/` intacto). Fichero congelado ya formateado con Prettier, `shasum` `6628de6c…`. Nota: el test de la cola elige «En curso» (retenido) y luego «Pendiente», para que la fila no salga de la vista por defecto en medio y el estado final distinga una cola que funciona (Pendiente) de una que no (En curso).
- [X] T004 [P] [Frontend · lib] En `frontend/src/lib/task-status.ts`, añadir `export function byListOrder(a: Task, b: Task): number` (`createdAt` desc y, a igualdad, `id` desc), **movida** desde `frontend/src/pages/tasks-page.tsx`, que borra su copia local y la importa de `@/lib/task-status`. Sin cambio de comportamiento; `STATUS_LABELS` y su orden no cambian (research §12) — depende de T003
- [X] T005 [P] [Frontend · lib] Crear `frontend/src/lib/task-status-sync.ts` con `createTaskStatusSync(token, { onSaved, onFailed }): { change(task, next) }` y el tipo `TaskStatusSyncHandlers` del [contrato](./contracts/board-ui.md#libtask-status-syncts-nuevo): el bucle actual de `TaskStatusSelect` (confirmado, en vuelo, cola de solo la última elección, vuelta al confirmado y descarte de la cola si falla) **movido sin cambios**, pero con el estado en un `Map` por id de tarea y fuera de React. `onSaved(task, settled)` en cada confirmación (`settled` = no queda nada en cola); `onFailed(taskId, confirmed, error)`. Un error que no sea `ApiError` se convierte en `new ApiError('Algo ha ido mal. Inténtalo de nuevo.', 0)`. Sin `fetch` propio: llama a `updateTaskStatus` de `@/lib/api`. Sin React — depende de T003
- [X] T006 [P] [Frontend · componente] Crear `frontend/src/components/tasks/task-status-control.tsx` con `TaskStatusControl({ task: Pick<Task,'id'|'title'>, value, error?, onChange })`: el marcado actual de `TaskStatusSelect` **tal cual** (mismo `<div>` contenedor, `<select>` nativo con las mismas clases `cn(...)`, `aria-label="Estado de «{título}»"`, una `<option>` por entrada de `STATUS_LABELS`, `aria-invalid` y `aria-describedby="task-{id}-status-error"` solo con error, `FieldError` con ese id debajo, **nunca** `disabled`, con su comentario). Controlado, sin estado ni red — depende de T003
- [X] T007 [Frontend · componente] Reescribir el interior de `frontend/src/components/tasks/task-status-select.tsx` sobre T005 + T006, **conservando su API** (`task`, `token`, `onUpdated`) y su comportamiento en la lista: `shown`/`error` locales; una instancia propia de `createTaskStatusSync` (estable entre renders, p. ej. `useRef`/`useState` perezoso); `onChange` → `setShown(next)`, `setError(undefined)`, `sync.change(task, next)`; `onSaved` → `onUpdated(task)` en **cada** confirmación; `onFailed` → `setShown(confirmed)` y `setError(error.message)` **sin prefijo**. Mantener el comentario JSDoc del componente — depende de T005, T006
- [X] T008 [Frontend · verificación] Desde `frontend/`: `npx playwright test e2e/task-status-list.spec.ts` sigue **en verde** y `git diff -- e2e/task-status-list.spec.ts` respecto a T003 está **vacío** (ni una aserción tocada); `npm run test:e2e` (smoke + caracterización) en verde; `npm run lint` y `npm run build` en verde. Punto de commit (humano): caracterización + extracción — depende de T004, T007
  - **Hecho**: `task-status-list.spec.ts` 4/4 en verde con el mismo `shasum` que en T003 (fichero sin tocar); `npm run test:e2e` 6/6; lint y build en verde. Decisión: `TaskStatusSelect` guarda `onUpdated` en un `ref` para que la instancia de sincronización (creada una vez con `useState` perezoso) llame siempre al último; la sincronización conserva por tarea el último confirmado, como hacía el `useRef` del componente.
- [X] T009 [Frontend · e2e helpers] En `frontend/e2e/support.ts`, **añadir** (sin tocar `signUp`, `signIn`, `createTask` ni `expectNoSeriousA11yViolations`) los tres helpers del [contrato](./contracts/board-ui.md#helpers-de-frontende2esupportts), con su JSDoc: `setTaskStatus(request, member, taskId, status)` (`PATCH ${API_URL}/api/v1/tasks/{id}/status` con `{ status }` y el `Bearer` del miembro; falla si no es 2xx); `setTaskDueDate(request, member, taskId, day)` (`PUT ${API_URL}/api/v1/tasks/{id}/due-date` con `{ dueDate: day }`, `'AAAA-MM-DD'`; falla si no es 2xx); `scopeBoardTo(page, prefix)` (`page.route` sobre `GET **/api/v1/tasks?status=*`: `route.fetch()` real, y `route.fulfill` con la misma respuesta y `data` filtrado a las filas cuyo `title` empieza por `prefix`; no intercepta ningún otro método ni el `GET` sin `status`). `npm run build` en verde (typecheck de `e2e/` con `tsconfig.e2e.json`) — depende de T008
  - **Hecho**. Decisión: `scopeBoardTo` intercepta con un predicado de URL (`isTasksByStatusUrl`: `pathname === '/api/v1/tasks'` y `searchParams.has('status')`) en vez del glob `**/api/v1/tasks?status=*`, porque en el glob de Playwright `?` no es un comodín fiable; el predicado se exporta también para que `board.spec.ts` intercepte la misma lectura (500, retenida) sin repetirlo. Es un añadido a `support.ts`; los helpers existentes no cambian.

**Checkpoint**: La lista se comporta igual que antes y lo prueba la caracterización; reconciliación, control y orden ya son compartibles; los helpers del tablero existen y compilan.

---

## Phase 3: La matriz del tablero, en rojo (bloques de US1, US2 y US3) ⚠️

**Purpose**: Escribir `frontend/e2e/board.spec.ts` **completo, bloque a bloque por historia**, y verlo fallar **por la razón correcta** antes de implementar nada del tablero (principio II v1.2.0). Hoy `/tasks/board` no es una ruta del tablero: la captura `/tasks/:id` y pinta `TaskPage` con el id «board» (alerta «Esta tarea ya no existe» o «No se ha podido cargar la tarea»), sin `h1` «Tablero», sin regiones de columna, y la lista no tiene enlace «Tablero».

**Reglas comunes a los tres bloques** (research §9): cada test crea sus miembros con `signUp` y sus tareas con títulos únicos (prefijo por test con `Date.now()` + aleatorio); recuentos por **invariante** (número del nombre del `h2` = número de `listitem` de la región) o por **diferencia** antes/después, nunca absolutos; regiones por `getByRole('region', { name: /^Pendiente \(/ })` y equivalentes; columnas vacías y espacio vacío solo con `scopeBoardTo`; fallos al guardar con `page.route` (`500`, `404` simulado, o respuesta retenida); en los tests de teclado, solo `Tab`/`Shift+Tab`/`Enter` con `toBeFocused` en cada paso relevante y `selectOption` sobre el `<select>` ya enfocado, ningún clic. Los textos esperados, literales del [contrato](./contracts/board-ui.md#anuncios-y-mensajes).

- [X] T010 [US1] [Frontend · e2e] En `frontend/e2e/board.spec.ts` (nuevo), escribir el bloque `test.describe('US1 · ver el tablero y abrir una tarea', …)` con los 11 tests de la [tabla de US1](./contracts/board-ui.md#us1-p1--ver-el-tablero-y-abrir-una-tarea), titulados exactamente como en ella (`US1-1 · DADO …` a `US1-11 · DADO …`) y con el «Cómo» de cada fila. Precisiones: US1-1 con dos miembros y tareas propias y ajenas llevadas a cada estado con `setTaskStatus`; US1-4 con `setTaskDueDate` a un día pasado y aserciones de ausencia («Vence», «Vencida», la fecha, `img`, iniciales); US1-8 **afirma primero** que `/tasks/board` muestra el `h1` «Tablero» y solo después hace `goto('/')` → `/tasks` con `h1` «Tareas» (si no, nacería en verde), y además, en un **contexto nuevo** (`browser.newContext()`), `signIn` con el mismo miembro y `goto('/')` → `/tasks` con `h1` «Tareas» (el «inicia sesión» del escenario); US1-9 con `scopeBoardTo`, solo teclado, recorrido lista → «Tablero» → título → control de cada tarjeta, columna a columna → `Enter` en un título → «Volver al tablero» → foco en ese título → `Shift+Tab` hasta «Lista» → `/tasks`; US1-10 con `page.route` de `GET **/api/v1/tasks?status=*` → `500`, 0 regiones, `expectNoSeriousA11yViolations` con la alerta de error en pantalla, y tras `page.unroute` «Reintentar» → 3 regiones; US1-11 en un solo test con dos mitades: sin sesión, `goto('/tasks/board')` → `/login` sin regiones de columna, y después `signUp` + `signIn` + `goto('/tasks/board')` → `h1` «Tablero» (la segunda mitad es la que lo hace nacer en rojo por la razón correcta: hoy `/tasks/:id` captura `/tasks/board` y ya está dentro de `ProtectedRoute`, así que la primera mitad sola pasaría sin tablero) — depende de T009
- [X] T011 [US2] [Frontend · e2e] En `frontend/e2e/board.spec.ts`, escribir el bloque `test.describe('US2 · mover de columna', …)` con los 9 tests de la [tabla de US2](./contracts/board-ui.md#us2-p2--mover-de-columna), titulados exactamente (`US2-1 · DADO …` a `US2-9 · DADO …`), **más** `Caso límite · mover dos veces seguidas la misma tarjeta deja la última elección, en pantalla y guardada` (primer `PATCH` retenido; control a «En curso» y luego a «Hecho»; se suelta; tarjeta en «Hecho» y, tras `reload()`, en «Hecho»). Arrastre con `card.dragTo(región)` (US2-1, US2-4, US2-5, US2-7, US2-8); US2-2 solo teclado, control `toBeFocused` en la nueva columna; US2-3 con `page.on('dialog')` que hace fallar el test si salta; US2-5 con el texto completo «No se ha guardado el cambio. Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» y, **dentro del mismo test** (la matriz no gana tests), dos rechazos más de la misma tarjeta con su vuelta a «Pendiente», sus recuentos como antes y su texto literal del contrato: `PATCH` → `401` («No se ha guardado el cambio. Tu sesión ha caducado. Vuelve a iniciar sesión.») y `PATCH` con `route.abort()` («No se ha guardado el cambio. No se pudo conectar con el servidor. Comprueba que el backend está arrancado.»); US2-6 con `PATCH` → `404` simulado con el cuerpo de error de Adonis, mensaje con «Esta tarea ya no existe» y sin «Algo ha ido mal»; US2-7 contando los `PATCH` (0) tras soltar en su región y luego sobre el `h1`; US2-8 con A, B, C creadas en orden y el orden C, B, A en «En curso» — depende de T010
- [X] T012 [US3] [Frontend · e2e] En `frontend/e2e/board.spec.ts`, escribir el bloque `test.describe('US3 · columnas vacías y pantallas estrechas', …)` con los 7 tests de la [tabla de US3](./contracts/board-ui.md#us3-p3--columnas-vacías-y-pantallas-estrechas), titulados exactamente (`US3-1 · DADO …` a `US3-7 · DADO …`), **más** `SC-007 · el tablero no tiene violaciones graves ni críticas de accesibilidad con tareas, con columnas vacías y con un cambio fallido` (`expectNoSeriousA11yViolations` en los tres estados: con tareas; con `scopeBoardTo` y columnas vacías; tras un movimiento con `PATCH` → `500`). US3-1 a US3-4 con `scopeBoardTo`; US3-2 con el `500` retenido para ver la vacía durante el vuelo y su desaparición al volver; US3-5 y US3-6 con `page.setViewportSize({ width: 320, height: 800 })`, una tarea de título muy largo, regiones con misma `x` e `y` creciente y `document.documentElement.scrollWidth <= clientWidth`; US3-7 con los tres estados (respuesta retenida → «Cargando el tablero…» sin regiones ni alerta; `500` → alerta sin regiones ni «Cargando»; `scopeBoardTo` vacío → regiones con su vacía, sin alerta ni «Cargando») — depende de T011
- [X] T013 [Frontend · verificación] Rojo por la razón correcta. Desde `frontend/`: `npm run build` en verde (la matriz **compila**: un error de tipos no es un rojo válido). Después `npx playwright test e2e/board.spec.ts`: **todos los tests en rojo, sin excepción**, y cada fallo **en la primera aserción sobre el tablero** —`h1` «Tablero» no encontrado, URL distinta de `/tasks/board`, región de columna o enlace «Tablero» inexistente— porque la ruta todavía no existe. En US1-8 y US1-11 las comprobaciones previas que no dependen del tablero (en US1-11, que sin sesión se acaba en `/login`) pueden pasar; el test tiene que caer en el `h1` «Tablero». **No valen** como rojo: un fallo en `signUp`/`signIn`/`createTask`/`setTaskStatus`/`setTaskDueDate`/`scopeBoardTo`, un selector mal escrito, ni un timeout antes de llegar al tablero; si aparece alguno, se corrige el test o el helper ahora y se repite. Si **algún** test sale en verde, nació en verde: se reescribe ahora, antes de implementar, hasta que falle por la razón correcta. Anotar el recuento («29 ✗ / 0 ✓», 29 tests en total: 27 escenarios + caso límite + SC-007) y, para cada bloque, la primera línea de un fallo representativo. Punto de commit (humano): helpers + matriz en rojo — depende de T012
  - **Rojo verificado: 29 ✗ / 0 ✓** (`npm run build` en verde antes: la matriz compila). Primer fallo por bloque: **US1** — `expect(getByRole('heading', { name: 'Tablero', level: 1 })).toBeVisible()` → *element(s) not found* (US1-1…6, US1-8, US1-11 tras su primera mitad, que pasa); US1-7 y US1-9 → enlace «Tablero» *not found* en la lista; US1-10 → `getByRole('alert')` sin «No se ha podido cargar el tablero». **US2** y **Caso límite** — `h1` «Tablero» *not found* en `openBoard`. **US3** y **SC-007** — `h1` «Tablero» *not found*. Ninguno cae en `signUp`/`createTask`/`setTaskStatus`/`setTaskDueDate`/`scopeBoardTo`. Corregido antes de congelar: US1-7 y US1-9 caían por *timeout* de 30 s al buscar el enlace «Tablero» (razón correcta, señal pobre); ahora afirman `toBeVisible()` del enlace antes de pulsarlo. Fichero congelado ya formateado (`shasum` en `/tmp/flowsync-board.sha` durante la sesión).
  - **Decisiones al escribir la matriz** (dentro del «Cómo» del contrato, sin cambiar ningún título): (1) `scopeBoardTo` también en **US2-2**, **US3-6** (recorridos con `Tab`: sin acotar habría que tabular por cientos de tarjetas acumuladas en la BD compartida) y **US2-8** (para poder soltar «abajo» de la columna sin que mida miles de píxeles). (2) El arrastre coge la tarjeta por su margen (`sourcePosition` 10,10: ni el enlace ni el `<select>`) y suelta cerca de la cabecera de la columna destino (`targetPosition` 16,16), salvo US2-8, que suelta abajo. (3) US2-1 comprueba además el anuncio «… está ahora en «En curso».» y US2-5 el de vuelta atrás, con los textos del contrato. (4) US2-9 crea una segunda tarea pendiente como testigo de que la lista ha cargado antes de afirmar la ausencia. (5) US1-4 usa un responsable «Zoe Quintana» para comprobar que las iniciales («ZQ») no salen. (6) US1-8 abre el contexto nuevo con la URL completa (`http://localhost:5173/`), porque `browser.newContext()` no hereda el `baseURL` de la configuración.

**Checkpoint**: La matriz entera existe, compila y está en rojo porque no hay tablero. A partir de aquí ningún título ni aserción de `board.spec.ts` se edita para que pase.

---

## Phase 4: User Story 1 - Ver el tablero con las tres columnas y abrir una tarea (Priority: P1) 🎯 MVP

**Goal**: `/tasks/board`, dentro de `ProtectedRoute` y `TasksLayout`: `h1` «Tablero», enlace «Lista», tres regiones de columna en orden «Pendiente», «En curso», «Hecho» con su recuento, cada tarea del espacio una sola vez en la columna de su estado (también las hechas), tarjetas con título (que abre la tarea), responsable y control de estado; «Tablero» desde la lista y «Volver al tablero» desde una tarea abierta desde el tablero; cargando y error de carga con «Reintentar»; la lista sigue siendo la entrada (FR-001 a FR-010, FR-024 a FR-026).

**Independent Test**: Desde `frontend/`, `npx playwright test e2e/board.spec.ts -g "US1-"` en verde (11 tests), sin mover ninguna tarjeta; y `quickstart.md` §1.

- [X] T014 [P] [US1] [Frontend · lib/api] En `frontend/src/lib/api.ts`, añadir `listTasksByStatus(token): Promise<Record<TaskStatus, Task[]>>` con el JSDoc del [contrato](./contracts/board-ui.md#libapits): tres `listTasks(token, status)` en paralelo (`pending`, `in_progress`, `done`) con `Promise.all` (falla entera si falla una: nunca columnas a medias); cada columna en el orden en que llega; **descarta duplicados por `id`** quedándose con la primera aparición en el orden de las columnas (research §1). No tocar `listTasks`, `updateTaskStatus`, `toApiError` ni ningún mensaje existente — depende de T013
- [X] T015 [P] [US1] [Frontend · componente] Crear `frontend/src/components/board/board-card.tsx` (`BoardCard`): `<li id="board-task-{id}">` con `Card className="gap-2 px-4 py-3"`; `Link id="board-task-{id}-link" to="/tasks/{id}" state={{ from: 'board' }} draggable={false}` con el título (`font-medium`, foco visible como el enlace de fila de la lista); `<span className="text-muted-foreground text-sm">` con `assignee.fullName ?? 'Sin nombre'`; y `TaskStatusControl` con `value`, `error` y `onChange` recibidos por props. Muestra **solo** título, responsable y estado: ni prioridad, ni foto/iniciales, ni fecha, ni «Vencida»; ningún botón de crear, editar, borrar, reasignar ni filtrar (FR-004, FR-010). El `<li>` no es enfocable. (El arrastre llega en T024; `min-w-0`/`wrap-break-word` en T030) — depende de T013
- [X] T016 [P] [US1] [Frontend · componente] Crear `frontend/src/components/board/board-column.tsx` (`BoardColumn`): `Card` con `role="region"`, `aria-labelledby="board-column-{estado}-title"` y `gap-3 px-4 py-4`; `<h2 id="board-column-{estado}-title" className="flex items-center gap-2 text-lg font-semibold">` con `STATUS_LABELS[estado]`, la píldora `<span aria-hidden="true" className="rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground">{n}</span>` y `<span className="sr-only">({n} tarea|tareas)</span>` (singular con 1); `<ul className="flex flex-col gap-2">` con un `BoardCard` por tarea **solo si hay tareas** (nunca un `<ul>` vacío). El recuento `n` se calcula de las tareas que pinta (FR-003). (El mensaje de vacía llega en T028; el destino de soltar en T025) — depende de T013
- [X] T017 [US1] [Frontend · página] Crear `frontend/src/pages/board-page.tsx` (`BoardPage`): contenedor `bg-muted/40 min-h-svh p-6`; cabecera con `h1` «Tablero» y, a la derecha, `Button variant="outline" size="sm" asChild` + `Link to="/tasks"` «Lista» con `ListIcon` `aria-hidden`; `<p role="status" className="sr-only">` siempre presente (vacío por ahora; se usa en T026). Carga con `listTasksByStatus(token)` (token de `useAuth()`, sin tocar `src/auth/`) y tres situaciones mutuamente excluyentes ([tabla del contrato](./contracts/board-ui.md#página-tasksboard-pagesboard-pagetsx)): **cargando** (`<p role="status">` con `Loader2Icon` animado `aria-hidden` y «Cargando el tablero…», sin regiones); **error** (`Alert variant="destructive"`, `AlertTitle` «No se ha podido cargar el tablero», `AlertDescription` con `ApiError.message` y `Button variant="outline" size="sm"` «Reintentar» que lanza un intento nuevo, salvo `401`; sin regiones; FR-008); **cargado** (rejilla `grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start` con tres `BoardColumn` en el orden de `STATUS_LABELS`). Las tareas, en estado de la página. Al llegar con `location.state.focusTaskId`, tras cargar, enfocar `#board-task-{id}-link` (research §5, como la lista con `focusTaskId`). El `onChange` del control de cada tarjeta se conecta en T022 — depende de T014, T015, T016
- [X] T018 [US1] [Frontend · rutas] En `frontend/src/routes/app-routes.tsx`, añadir `<Route path="/tasks/board" element={<BoardPage />} />` dentro de `ProtectedRoute` > `TasksLayout`, entre `/tasks` y `/tasks/:id` (contrato → Ruta). No tocar la redirección de `*` a `/tasks` ni `PublicOnlyRoute` (FR-007). Como el tablero queda dentro de `TasksLayout`, el filtro de la lista se mantiene también al ir al tablero y volver (research §7): actualizar **solo** el comentario JSDoc de `TasksLayout` en `frontend/src/routes/tasks-layout.tsx`, que hoy dice «mientras se va y se vuelve de una tarea, y solo entonces», para que diga que se guarda al ir y volver de una tarea o del tablero, y que recargar, cerrar sesión o salir a otra pantalla (p. ej. `/profile`) lo devuelven a la vista por defecto. El código de `TasksLayout` no cambia — depende de T017
- [X] T019 [P] [US1] [Frontend · página] En `frontend/src/pages/tasks-page.tsx`, convertir la cabecera en `h1` «Tareas» + enlace **«Tablero»** → `/tasks/board` (`Button variant="outline" size="sm" asChild` + `Link`, `Columns3Icon` `aria-hidden`). Nada más cambia en la lista (FR-006) — depende de T013
- [X] T020 [P] [US1] [Frontend · página] En `frontend/src/pages/task-page.tsx`, hacer que `BackToList` lea `location.state?.from`: si es `'board'`, el enlace dice **«Volver al tablero»** y va a `/tasks/board` con `state={{ focusTaskId }}`; si no, exactamente como hoy («Volver a la lista» → `/tasks`). Aplica a las tres variantes de la página (tarea cargada, «Esta tarea ya no existe», «No se ha podido cargar la tarea») (FR-005, research §7) — depende de T013
- [X] T021 [US1] [Frontend · verificación] Desde `frontend/`: `npx playwright test e2e/board.spec.ts -g "US1-"` en **verde** (11/11) sin haber editado ningún test; `npx playwright test e2e/task-status-list.spec.ts` sigue en verde; `npm run lint` y `npm run build` en verde. Punto de commit (humano): US1 — depende de T018, T019, T020
  - **Hecho**: `-g "US1-"` **11/11**; caracterización 4/4; lint y build en verde. Pantalla revisada con capturas a 1280 y 320 px (el título largo desborda a 320 px hasta T030, como estaba previsto).
  - ⚠️ **Única edición de `board.spec.ts` después de T013, y por qué**: US1-4 falló por un **selector roto del propio test**, no por el tablero. El helper `cardIn(scope, title)` pasaba `scope.getByRole('link', …)` como `filter({ has })`, y Playwright resuelve `has` **dentro de cada `listitem`**: con `scope` = una región buscaba una región dentro de la tarjeta, así que no podía encontrar nada con **ninguna** implementación (afectaba también a US2-1, US2-3, US2-4, US2-5, US2-8 y US3-3). En T013 no se vio porque todos caían antes, en el `h1` «Tablero». Es el caso que T013 declara rojo no válido («un selector mal escrito»): se corrigió **solo ese helper** para que el `has` parta de la página (`scope.page()`), con un comentario; ninguna aserción, título ni paso cambia. Queda a la vista del revisor humano. Nuevo `shasum` de referencia del fichero: `1f69dbef…`.
  - Decisión de maquetación: en la tarjeta, responsable y control comparten fila (`flex flex-wrap justify-between`), con el título encima; el control es el de la lista sin cambios.

**Checkpoint**: El tablero se ve, se abre una tarea y se vuelve, solo con teclado incluido. Es un punto de validación, no de entrega: el control de cada tarjeta aún no guarda (llega con US2), y el PR es uno solo con las tres historias (plan, principio V).

---

## Phase 5: User Story 2 - Mover una tarea de columna, con ratón y sin ratón (Priority: P2)

**Goal**: La tarjeta cambia de columna eligiendo otro estado en su control (camino garantizado, sin ratón) o arrastrándola (atajo de ratón, API nativa de HTML5); salta al instante a su sitio por `byListOrder` y los recuentos cambian; si no se guarda vuelve a la columna del último confirmado con «No se ha guardado el cambio. …»; el foco sigue a la tarjeta, en su control; soltar en su columna o fuera no hace nada (FR-011 a FR-019).

**Independent Test**: Desde `frontend/`, `npx playwright test e2e/board.spec.ts -g "US2-|Caso límite"` en verde (10 tests); y `quickstart.md` §2.

- [X] T022 [US2] [Frontend · página] **Camino sin ratón con el control de la lista.** En `frontend/src/pages/board-page.tsx`, conectar el `TaskStatusControl` de cada tarjeta (el mismo `<select>` de `TaskStatusSelect`, extraído en T006: mismas tres opciones, mismo `aria-label`, ≤ 2 interacciones, sin confirmación; FR-012) a **una sola** `createTaskStatusSync(token, …)` para toda la página, estable entre renders, que sobrevive a que la tarjeta cambie de columna (research §2). Una función `move(task, next)` común a control y arrastre: si `next` es el estado mostrado, no hace nada; si no, cambio **optimista** (la tarea pasa a `next`, se recoloca con `byListOrder`, se borra su error) y `sync.change(task, next)`. `onSaved(task)` → se sustituye por la tarea que devuelve el servidor. `onFailed(id, confirmed, error)` → la tarea vuelve a `confirmed` (recuentos incluidos, porque se derivan de las tarjetas) y su error pasa a ser `'No se ha guardado el cambio. ' + error.message`, que la tarjeta pasa como `error` al control (`FieldError` enlazado por `aria-describedby`). La lista no cambia: sigue con `TaskStatusSelect` y su mensaje sin prefijo (research §11) — depende de T021
- [X] T023 [US2] [Frontend · página] **Foco tras mover** (research §5, contrato → Foco). En `frontend/src/pages/board-page.tsx`: al mover (por control o por arrastre) y al volver atrás por un fallo, guardar en un `ref` el id de la tarjeta a enfocar y, en un `useEffect` posterior al render, enfocar el `<select>` dentro de `#board-task-{id}` en la columna donde queda. En la vuelta atrás tardía, solo si el foco estaba dentro de esa tarjeta o se había caído al `<body>` por el desmontaje; si la persona ya está en otro elemento, no se mueve. Nunca dejar el foco en `<body>` — depende de T022
- [X] T024 [P] [US2] [Frontend · componente] **Arrastre nativo, sin dependencias (la tarjeta).** En `frontend/src/components/board/board-card.tsx`: el `<li>` con `draggable`, `data-dragging` y la clase `data-[dragging=true]:opacity-50`; `onDragStart` → `dataTransfer.effectAllowed = 'move'`, `dataTransfer.setData('text/plain', String(task.id))` y aviso al padre (`onDragStart(task.id)`); `onDragEnd` → aviso al padre, haya soltado o no. El enlace del título sigue con `draggable={false}`; el `<select>` no inicia arrastres. **Sin** `aria-grabbed`, `aria-dropeffect` ni `aria-roledescription`, y el `<li>` sigue sin ser enfocable (research §4) — depende de T021
- [X] T025 [P] [US2] [Frontend · componente] **Arrastre nativo, sin dependencias (la columna como destino).** En `frontend/src/components/board/board-column.tsx`: la **región entera** es el destino (también vacía, para US3-3). Props `draggingFrom?: TaskStatus` y `onDrop()`. `onDragOver` → `preventDefault()` y `dropEffect = 'move'` **solo** si se está arrastrando una tarjeta de **otra** columna; en su propia columna, nada. `onDragEnter`/`onDragLeave` con un **contador** (porque `dragleave` salta en cada hijo) para marcar el destino activo con `bg-accent border-ring` (tokens existentes, ninguno nuevo); `onDrop` → `preventDefault()`, limpia el marcado y llama a `onDrop()` solo si la tarjeta es de otra columna (research §3) — depende de T021
- [X] T026 [US2] [Frontend · página] En `frontend/src/pages/board-page.tsx`, **cablear el arrastre y los anuncios**: estado `draggingId` (lo ponen y lo limpian `onDragStart`/`onDragEnd` de `BoardCard`); cada `BoardColumn` recibe `draggingFrom` (estado de la tarjeta arrastrada) y `onDrop` → `move(tarea arrastrada, estado de la columna)`, la **misma** puerta que el control (T022), así que comparten cola. Soltar en su columna o fuera de cualquier columna no llega a `move`: ni petición, ni mensaje, ni foco (FR-017). La tarjeta cae en su sitio por `byListOrder`, nunca donde se soltó (FR-018). El `<p role="status" className="sr-only">` dice, con los textos exactos del [contrato](./contracts/board-ui.md#anuncios-y-mensajes), `«{t}» está ahora en «{E nuevo}».` al mover y `No se ha guardado el cambio: «{t}» vuelve a «{E confirmado}».` al fallar — depende de T023, T024, T025
- [X] T027 [US2] [Frontend · verificación] Desde `frontend/`: `npx playwright test e2e/board.spec.ts -g "US2-|Caso límite"` en **verde** (10/10) sin editar ningún test; `-g "US1-"` sigue en verde; `npx playwright test e2e/task-status-list.spec.ts` sigue en verde; `npm run lint` y `npm run build` en verde; `git diff <base T001> -- package.json package-lock.json` **vacío** (el arrastre no trajo ninguna dependencia). Punto de commit (humano): US2 — depende de T026
  - **Hecho**: `-g "US2-|Caso límite"` **10/10** sin tocar `board.spec.ts` (mismo `shasum` que tras T021); `-g "US1-"` 11/11; caracterización 4/4; lint y build en verde; diff de `package.json`/`package-lock.json` vacío. Pantalla revisada con capturas: tarjeta arrastrada al 50 %, columna destino con `bg-accent border-ring`, y tras un `500` la tarjeta en su columna con «No se ha guardado el cambio. …», el foco en su control y el anuncio de vuelta atrás.
  - **Decisiones**: (1) `onSaved` solo sustituye la tarea cuando `settled` es cierto: con otra elección en cola, la confirmación intermedia no devuelve la tarjeta a la columna anterior (caso límite). (2) La sincronización se crea en el primer movimiento (`sync.current ??= …`), con el token ya garantizado. (3) Al soltar, la página limpia `draggingId` en el propio `drop`: la tarjeta se desmonta al cambiar de columna y su `dragend` ya no llega a React. (4) El resaltado de la columna destino solo se pinta mientras `accepts` (tarjeta de otra columna), así que un contador que quedase desfasado no deja una columna marcada fuera de un arrastre. (5) El `<li>` recuerda dónde se pulsó y cancela el `dragstart` si fue en el `<select>`.

**Checkpoint**: Mover funciona con ratón y con teclado, con vuelta atrás y foco correctos; tablero y lista enseñan el mismo estado guardado (US2-9).

---

## Phase 6: User Story 3 - Columnas vacías y pantallas estrechas (Priority: P3)

**Goal**: Una columna sin tareas muestra 0 y «No hay tareas en este estado.» (y el mensaje aparece y desaparece en el acto al mover); el espacio sin tareas dice que se crean desde la lista y lleva a ella; cargando, error y vacía se distinguen; en pantallas estrechas las columnas se apilan en orden y la página nunca se desplaza en horizontal (FR-020 a FR-023).

**Independent Test**: Desde `frontend/`, `npx playwright test e2e/board.spec.ts -g "US3-|SC-007"` en verde (8 tests); y `quickstart.md` §3 y §4.

- [X] T028 [US3] [Frontend · componente] En `frontend/src/components/board/board-column.tsx`, cuando la columna no tiene tareas, pintar **en lugar del `<ul>`** `<p className="text-muted-foreground text-sm">No hay tareas en este estado.</p>`. Como depende de las tareas que pinta, aparece o desaparece en el acto al mover y al volver atrás (FR-020, US3-2, US3-3) — depende de T027
- [X] T029 [US3] [Frontend · página] En `frontend/src/pages/board-page.tsx`, situación **espacio sin tareas** (cargado, 0 tareas en total): `Card` + `CardHeader` con `CardTitle` «Todavía no hay tareas» y `CardDescription` «Las tareas se crean desde la lista. [Ir a la lista] para anotar la primera.», con «Ir a la lista» como `Link` a `/tasks`; **debajo**, las tres columnas con su vacía (FR-021, US3-4). Comprobar que cargando, error y columnas vacías siguen siendo mutuamente excluyentes y distintos a simple vista (FR-022, US3-7) — depende de T028
- [X] T030 [US3] [Frontend · componentes] **Vista estrecha** (research §8, FR-023, SC-008). En `frontend/src/components/board/board-column.tsx`, añadir `min-w-0` a la región (sin él, un hijo de rejilla no encoge por debajo de su contenido); en `frontend/src/components/board/board-card.tsx`, añadir `wrap-break-word` al enlace del título (un título largo parte líneas en vez de ensanchar la columna); en `frontend/src/pages/board-page.tsx`, confirmar la rejilla `grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start` (apiladas en el mismo orden por debajo de `md`, 768 px; tres a la misma `y` en 1280). Nada con ancho fijo ni `overflow-x` en ninguno de los tres ficheros. Comprobar a 320 × 800 que el control de estado sigue moviendo la tarjeta y el foco la sigue (US3-6) — depende de T029
- [X] T031 [P] [US3] [Docs · diseño] En `DESIGN.md`, sección «Components», añadir los **dos patrones** del tablero sin valores ni tokens (research §10): **columna con recuento** (región `Card` con `h2` + píldora `bg-secondary`/`text-secondary-foreground` con el número y su texto `sr-only`; vacía con texto `text-muted-foreground`, nunca en blanco; apiladas por debajo de `md`) y **destino al arrastrar** (`bg-accent` + `border-ring` en la columna destino, `opacity-50` en la tarjeta arrastrada; el arrastre es siempre un atajo con alternativa por teclado). No tocar los tokens ni el bloque YAML — depende de T027
- [X] T032 [US3] [Frontend · verificación] Desde `frontend/`: `npx playwright test e2e/board.spec.ts` **entero en verde** (US1, US2, US3, caso límite y SC-007) sin editar ningún test desde T013 (`git diff` de `e2e/board.spec.ts` respecto a T013 vacío); `npm run lint` y `npm run build` en verde. Punto de commit (humano): US3 + DESIGN.md — depende de T030, T031
  - **Hecho**: `board.spec.ts` **29/29** en verde; su único diff desde T013 es la corrección del helper `cardIn` anotada en T021 (ninguna aserción cambia). Lint y build en verde. Pantalla revisada a 320 y 1280 px: columnas apiladas en orden, título largo partido dentro de su tarjeta, espacio vacío con «Todavía no hay tareas» e «Ir a la lista» sobre las tres vacías.
  - **Decisión (T030)**: además de `min-w-0` en la región y `wrap-break-word` en el título, el enlace del título lleva `max-w-full`. Sin él, US3-5 desbordaba 661 px: el enlace es `self-start` y toma su ancho por contenido, y `overflow-wrap: break-word` no reduce el ancho mínimo de una palabra larga; con `max-w-full` el enlace no pasa del ancho de la tarjeta y la palabra se parte. Sigue sin haber anchos fijos ni `overflow-x`.

**Checkpoint**: Las tres historias funcionan y la matriz entera está en verde.

---

## Phase 7: Polish & Cross-Cutting Concerns — valla, suites y revisión

**Purpose**: Demostrar que el cambio se queda dentro de su alcance y que todo está en verde antes de pedir revisión humana.

- [X] T033 [Frontend · verificación de diseño] Principio VI: ejecutar, desde la raíz del repo, el `grep` de `quickstart.md` §0 sobre **todos los `.tsx` de `frontend/src/` tocados** respecto a la base de T001, nuevos y modificados (sin seguimiento incluidos; `components/ui/` fuera): hoy `pages/board-page.tsx`, `components/board/board-column.tsx`, `components/board/board-card.tsx`, `components/tasks/task-status-control.tsx`, `components/tasks/task-status-select.tsx`, `pages/tasks-page.tsx`, `pages/task-page.tsx`, `routes/app-routes.tsx` y `routes/tasks-layout.tsx`. La expresión cubre hex, `rgb()`/`hsl()`/`oklch()` y demás funciones de color, valores arbitrarios `-[#…]`, `-[rgb…]`, `-[hsl…]`, `-[oklch…]`, `-[color:…]` y `-[var(…)]`, y **todas** las familias de la paleta de Tailwind (incluidos `white` y `black`) con **todos** los prefijos de utilidad de color (`bg`, `text`, `border*`, `ring*`, `outline`, `divide`, `fill`, `stroke`, `from`/`via`/`to`, `shadow`, `decoration`, `caret`, `placeholder`, `accent`…): **vacío**. Solo tokens semánticos — depende de T032
  - **Hecho**: grep vacío sobre los 9 `.tsx` tocados (los 9 que lista la tarea; `components/ui/` fuera). Ojo: en zsh `$TSX` no se parte en palabras y el grep no llega a mirar nada; se ejecutó con `bash -c`, más un control positivo (`bg-red-500` sí casa con el patrón).
- [X] T034 [Frontend · diseño · CONDICIONAL] **Solo si hiciera falta un color nuevo** (research §10 y el plan dicen que **no**: todo sale de tokens existentes): añadir el token en `frontend/src/index.css` (valor claro, valor oscuro y su entrada en `@theme inline`) **y**, en la **misma tarea**, documentarlo en `DESIGN.md` (bloque de tokens y su uso), usándolo después solo por su nombre semántico. Si no hace falta —lo esperado—, marcar esta tarea como **N/A** con una línea que lo diga, y `git diff <base T001> -- frontend/src/index.css` debe quedar vacío — depende de T033
  - **N/A**: no hizo falta ningún color nuevo; todo sale de tokens existentes (`bg-secondary`, `text-secondary-foreground`, `text-muted-foreground`, `bg-accent`, `border-ring`, `bg-muted/40`). `git diff 6f4e793 -- frontend/src/index.css` vacío.
- [X] T035 [Repo · validación manual] Recorrer `quickstart.md` §1 a §4 con `npm run dev` en `backend/` y en `frontend/` (incluido el recorrido solo con teclado, el modo responsive a 320 px y el fallo al guardar bloqueando `…/tasks/*/status` en las DevTools) y anotar aquí cualquier diferencia con el contrato — depende de T034
  - **Hecho** con los servidores de desarrollo y Chromium dirigido por scripts fuera del repo (no había MCP de Playwright en la sesión), con capturas revisadas a mano. **Sin diferencias con el contrato.** Comprobado además de la matriz: §1.6 recargar en `/tasks/board` sigue en el tablero; §1.7 con el backend **parado de verdad**, alerta «No se ha podido cargar el tablero» + «No se pudo conectar con el servidor…» + «Reintentar», sin columnas, y tras arrancarlo «Reintentar» pinta las tres; §1.8 «Cerrar sesión» en `/profile` y `/tasks/board` → `/login`; nombres accesibles reales de las regiones «Pendiente (166 tareas)», etc. **G4 / SC-009**: tablero de la BD compartida con **398 tarjetas** en **326 ms** desde `goto` hasta las tres columnas. **G6 / FR-024**: foco visible en el título (anillo) y en el control (el estilo de foco de la lista, sin cambios). G3 y G5 siguen pendientes de decisión humana, sin tocar.
- [X] T036 [Repo · cierre] **Tarea final**, en este orden; cada paso en verde antes del siguiente:
  1. **Valla intacta** respecto a la base de T001 (incluidos ficheros sin seguimiento, `git status --porcelain`): `git diff --stat <base> -- backend/` **vacío** (el backend entero, incluido `backend/.adonisjs/` y `backend/database/schema.ts`); `git diff --stat <base> -- frontend/src/auth/ frontend/src/components/ui/` **vacío**; `git diff --stat <base> -- '*/package.json' '*/package-lock.json'` **vacío**; `git diff <base> -- frontend/src/index.css` vacío (salvo que T034 se haya ejecutado, y entonces con su entrada en `DESIGN.md`); `frontend/e2e/smoke.spec.ts` y `frontend/e2e/task-status-list.spec.ts` (desde T003) sin diff. Los únicos ficheros tocados son los de plan.md → Project Structure.
  2. **Formato**: desde `frontend/`, `npm run format`; después `git status` no muestra cambios en ficheros ajenos al alcance (si Prettier tocara alguno, se revierte ese fichero).
  3. **Frontend en verde**: desde `frontend/`, `npm run build`, `npm run lint` y `npm run test:e2e` (smoke + caracterización + tablero) en verde. Anotar el recuento.
  4. **Backend en verde, sin cambios**: desde `backend/`, `npm test` en verde con el mismo número de tests que en T001.
  5. **Revisión adversarial**: lanzar el subagente `adversarial-reviewer` sobre el **diff completo** (`git diff <base>` + ficheros sin seguimiento; no hay PR) contra `specs/006-tablero/spec.md`, `plan.md`, `contracts/board-ui.md`, `BOUNDARIES.md` y la constitución v1.2.0. Cada hallazgo bloqueante se corrige y se repiten los pasos 1 a 4; los no bloqueantes que no se corrijan se anotan aquí con su motivo.
  6. Solo entonces, **pedir revisión humana**. **Sin commit, push ni PR**: los hace el humano — depende de T035
  - **Hecho.** (1) Valla intacta respecto a `6f4e793`: `backend/`, `frontend/src/auth/`, `frontend/src/components/ui/`, `package.json`/`package-lock.json` e `index.css` sin diff ni ficheros nuevos; `smoke.spec.ts` sin diff; `task-status-list.spec.ts` con el mismo `shasum` que en T003. Solo hay ficheros de plan.md → Project Structure, más este `tasks.md`. (2) `npm run format`: no tocó nada fuera del alcance. (3) Frontend: build y lint en verde; `npm run test:e2e` **35/35** (2 humo + 4 caracterización + 29 tablero). (4) Backend: `npm test` **121/121**, igual que en T001. (5) `adversarial-reviewer` sobre el diff completo: **APPROVE-WITH-NOTES, ningún bloqueante**, sin brechas de valla ni desajustes con la spec; verificó también en vivo el foco tras mover, fallar y no robar. No bloqueantes **no corregidos**, para decisión humana:
    - **Huecos de cobertura e2e** (el comportamiento funciona, comprobado a mano por el revisor y en T035, pero ningún test lo fija): foco tras un arrastre y tras una vuelta atrás, no robar el foco en una vuelta atrás tardía, anuncio «… está ahora en …» por el camino del control, ausencia de «Reintentar» con `401`, y que una confirmación intermedia (`settled=false`) no haga parpadear la tarjeta. No se añaden tests ahora porque nacerían en verde (principio II); si se quieren, en un cambio aparte con su rojo.
    - **`task-page.tsx`**: en las variantes «Esta tarea ya no existe» y «No se ha podido cargar la tarea», «Volver al tablero» lleva al tablero pero sin `focusTaskId` (igual que hoy «Volver a la lista» en esas variantes). Pasarle el id de la ruta cambiaría también la vuelta a la lista, que no entra en este alcance.
    - **Sincronización por instancia de `BoardPage`**: salir del tablero con un `PATCH` en vuelo, volver y mover esa misma tarea lanza una segunda petición sin cola común. Es el mismo caso que ya tiene la lista por fila; no es una regresión.
    - **`dragleave` al cancelar con Esc**: hipótesis del revisor, no reproducida en Chromium. El resaltado ya solo se pinta mientras hay un arrastre que la columna admite.
    - **`<ul>` con `list-style: none` en Safari/VoiceOver**: podría perder la semántica de lista; el contrato fija el marcado, se deja anotado (posible `role="list"`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001. **Bloquea todo lo demás**: caracterización verde (T003) → extracción (T004–T007) → verde otra vez (T008) → helpers (T009).
- **Matriz en rojo (Phase 3)**: depende de T009. Bloques US1 → US2 → US3 en el mismo fichero (secuenciales) → rojo verificado (T013). **Ninguna implementación del tablero antes de T013.**
- **US1 (Phase 4)**: depende de T013.
- **US2 (Phase 5)**: depende de US1 (T021): necesita la página, la columna y la tarjeta.
- **US3 (Phase 6)**: depende de US2 (T027): US3-2 y US3-3 mueven tarjetas, y las tres historias tocan los mismos tres ficheros del tablero.
- **Polish (Phase 7)**: depende de T032.

### User Story Dependencies

- **US1 (P1)**: tras Foundational y la matriz en rojo. Sin dependencias de otras historias.
- **US2 (P2)**: usa el tablero de US1; reutiliza la sincronización (T005) y el control (T006) de Foundational.
- **US3 (P3)**: usa el tablero de US1 y el movimiento de US2 (columna que se vacía o se llena al mover).

### Within Each User Story

- El bloque e2e de la historia está escrito y visto en rojo (Phase 3) **antes** de su implementación; cada historia termina con su bloque en verde sin editar ningún test.
- `lib/` antes que componentes; componentes antes que la página; página antes que la ruta.
- Cada historia, verificada (T021, T027, T032) antes de pasar a la siguiente.

### Parallel Opportunities

- Phase 2: T004, T005 y T006 en paralelo (tres ficheros distintos); T007 espera a T005 y T006.
- Phase 3: secuencial (un único fichero, `board.spec.ts`).
- US1: T014, T015, T016, T019 y T020 en paralelo (cinco ficheros distintos); T017 espera a T014–T016; T018 a T017.
- US2: T024 y T025 en paralelo (tarjeta y columna); T022 → T023 son la página y van secuenciales; T026 junta todo.
- US3: T031 (`DESIGN.md`) en paralelo con T028–T030.
- Polish: secuencial (T033 → T034 → T035 → T036); T036 es siempre la última.

---

## Parallel Example: Foundational

```bash
Task: "Añadir byListOrder a frontend/src/lib/task-status.ts e importarla en tasks-page.tsx"
Task: "Crear createTaskStatusSync en frontend/src/lib/task-status-sync.ts"
Task: "Crear TaskStatusControl en frontend/src/components/tasks/task-status-control.tsx"
```

## Parallel Example: User Story 1

```bash
Task: "Añadir listTasksByStatus en frontend/src/lib/api.ts"
Task: "Crear BoardCard en frontend/src/components/board/board-card.tsx"
Task: "Crear BoardColumn en frontend/src/components/board/board-column.tsx"
Task: "Enlace «Tablero» en frontend/src/pages/tasks-page.tsx"
Task: "«Volver al tablero» en frontend/src/pages/task-page.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Arrastre nativo en la tarjeta: frontend/src/components/board/board-card.tsx"
Task: "Columna como destino de soltar: frontend/src/components/board/board-column.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Columna vacía / espacio vacío / vista estrecha (board-column.tsx, board-page.tsx, board-card.tsx)"
Task: "Dos patrones del tablero en DESIGN.md (Components)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: línea base.
2. Phase 2: caracterización verde → extracción → verde otra vez → helpers.
3. Phase 3: matriz completa en rojo por la razón correcta.
4. Phase 4: US1 → **STOP and VALIDATE** con `-g "US1-"` y `quickstart.md` §1.

US1 es el punto de validación del MVP, no de entrega: el control de estado de la tarjeta aún no guarda hasta US2, y el plan prevé **un solo PR** con las tres historias.

### Incremental Delivery

1. Setup + Foundational → la lista igual que antes, con red de caracterización.
2. Matriz en rojo → la DoD del tablero escrita.
3. US1 → ver el tablero (11 verdes).
4. US2 → mover con ratón y teclado (10 verdes más).
5. US3 → vacíos y pantallas estrechas, `DESIGN.md` (8 verdes más; matriz completa).
6. Polish → valla, formato, suites, `adversarial-reviewer`, revisión humana. Commits y PR, del humano.

---

## Notes

- [P] = ficheros distintos, sin dependencias pendientes.
- Ningún test se edita para que pase: ni `task-status-list.spec.ts` después de T003, ni `board.spec.ts` después de T013.
- Los textos visibles y anunciados son los literales del contrato; si alguno no encaja al implementar, se vuelve al contrato, no se improvisa.
- Si algo del tablero pareciera necesitar tocar el backend, `src/auth/`, `components/ui/` o una dependencia nueva, se para y se vuelve a la spec (supuestos de la spec; principio III).
- La marca de vencida no entra (decisión de producto pendiente, spec → «Del prototipo a la spec»); US1-4 lo fija.

---

## Pendiente de decisión del humano (hallazgos BAJA de `/speckit-analyze`)

Anotados aquí **sin aplicar**: ninguno bloquea la implementación, y cada uno es una decisión del humano (aplicarlo, aplazarlo o descartarlo). C1, G1, G2, D1, K1, I2 y U1 ya están incorporados a este fichero, al contrato, al plan y a `quickstart.md`.

- **I1 · Títulos de los tests resumidos.** Los títulos de la matriz son resúmenes del escenario con su id (DADO/CUANDO/ENTONCES), no copias literales: US1-5 omite «la misma que se abre desde la lista» y US1-8 omite «(inicia sesión o…)». Es la convención del backend (`list_tasks_by_status.spec.ts`) y cada test se rastrea por su id. Propuesta: aceptarlo; o, si se quiere la lectura literal de «titulado como el escenario», recuperar esos incisos en los títulos de US1-5 y US1-8 antes de T010.
- **G3 · SC-006 a medias.** SC-006 pide mover con teclado a **cada una** de las otras dos columnas; US2-2 solo mueve a «Hecho». Propuesta: un segundo movimiento con teclado hacia otra columna dentro de US2-2 o de US3-6.
- **G4 · SC-009 sin comprobar.** Ninguna tarea abre el tablero con ~200 tareas. Propuesta: un paso en T035 (validación manual) con ~200 tareas.
- **G5 · SC-010 en un solo sentido.** US2-9 prueba que un cambio del tablero se ve en la lista; el contrario (cambio en la lista → tablero) no tiene test. Propuesta: opcional; ya lo cubre implícitamente US1-1, que deja tareas en un estado por la API.
- **G6 · Foco «siempre visible» sin test.** FR-024 / US1-9 piden el foco siempre visible y axe no lo comprueba. Propuesta: revisarlo a mano en T035 (ya está en `quickstart.md` §4).
- **D2 · `border-ring` con dos usos.** Es el token del foco y también marca la columna destino del arrastre (T025). Es un token semántico existente y T031 documenta el patrón en DESIGN.md. Propuesta: ninguna acción; queda anotado.
