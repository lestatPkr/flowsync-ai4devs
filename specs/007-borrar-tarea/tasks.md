---

description: "Task list for Borrar una tarea"
---

# Tasks: Borrar una tarea

**Input**: Design documents from `/specs/007-borrar-tarea/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/delete-task-api.md](./contracts/delete-task-api.md), [contracts/delete-task-ui.md](./contracts/delete-task-ui.md), [quickstart.md](./quickstart.md) y el modelo de amenazas [docs/security/threat-model-e2-10.md](../../docs/security/threat-model-e2-10.md)

**Tests**: Incluidos (principio II de la constitución **v1.2.0**: la matriz es la Definition of Done). Dos ficheros nuevos, ambos **escritos enteros y vistos en rojo antes de la primera línea de implementación de su capa**:

- `backend/tests/functional/tasks/delete_task.spec.ts` — la [matriz del API](./contracts/delete-task-api.md#matriz-de-comportamiento-definition-of-done) (21 tests), un `test.group` por historia.
- `frontend/e2e/delete-task.spec.ts` — la [matriz de interfaz](./contracts/delete-task-ui.md#matriz-de-comportamiento-definition-of-done) (19 tests), un `test.describe` por historia.

**Por qué el rojo se escribe por capa y no historia a historia.** Cada matriz tiene **una sola razón correcta de rojo**, y solo es cierta mientras no exista nada de la capa: en el backend, *la ruta `DELETE /api/v1/tasks/:id` no existe*; en el frontend, *la tarea abierta no tiene «Borrar tarea»* (y, solo para US3-4, *Vite no manda cabeceras anti-framing*). Si el bloque de US2 se escribiera después de implementar US1, sus filas de `401` y de «ya no existe» nacerían en verde (la ruta hereda `auth()` y `findOrFail` da el `404`), y lo mismo pasaría con la mayoría de los e2e de US2. Por eso: **bloques por historia → rojo de la capa entera → implementación historia a historia**, como en `specs/006-tablero/`. El frontend se escribe contra el backend ya terminado (los e2e usan el `DELETE` real). Los tests que un bloque posterior ya vuelve verde al implementar una historia anterior **no nacen en verde**: se vieron en rojo en su fase de rojo, y se anota.

Ningún test existente se edita ni se borra (`backend/tests/functional/**` existentes, `frontend/e2e/smoke.spec.ts`, `board.spec.ts`, `task-status-list.spec.ts`). Ninguna aserción de las matrices nuevas se toca para pasar a verde.

**Organization**: Tareas agrupadas por historia (US1/US2/US3 de `spec.md`) y en orden de dependencias. Cada tarea nombra **la capa y el archivo**. Ninguna tarea rediseña lo que `plan.md`, `research.md` y los contratos ya decidieron: los textos, ids, clases y códigos son los del contrato, literales. Cada mitigación R1–R10 del modelo de amenazas tiene **su propia tarea** al final de la historia que la recoge, apuntando a sus tests.

**Sin commits, push ni PR**: los hace el humano tras la revisión. Donde conviene un corte, la tarea lo señala como «punto de commit (humano)».

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2, US3)
- Tras la historia, entre corchetes, la **capa** (`Backend`, `Frontend`, `Repo`, `Docs`) y el tipo de tarea; en el texto, el archivo exacto

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React); **todos los comandos se ejecutan desde `backend/` o desde `frontend/`**, nunca desde la raíz. Ficheros que cambian (plan.md → Project Structure): `backend/app/controllers/tasks_controller.ts`, `backend/start/routes.ts`, `backend/.adonisjs/` (regenerado), `backend/tests/functional/tasks/delete_task.spec.ts` (nuevo), `frontend/vite.config.ts`, `frontend/e2e/delete-task.spec.ts` (nuevo), `frontend/e2e/support.ts` (solo añadidos), `frontend/src/lib/api.ts`, `frontend/src/components/tasks/delete-task-dialog.tsx` (nuevo), `frontend/src/components/tasks/task-deleted-notice.tsx` (nuevo), `frontend/src/pages/task-page.tsx`, `frontend/src/pages/tasks-page.tsx`, `frontend/src/pages/board-page.tsx` y `DESIGN.md`.

**No se tocan** (BOUNDARIES.md, plan.md → Constraints): `frontend/src/auth/`; `backend/app/middleware/` (en particular `auth_middleware.ts` y `silent_auth_middleware.ts`); `backend/app/validators/user.ts`; los controladores de auth (`new_account_controller.ts`, `access_tokens_controller.ts`, `profile_controller.ts`); `backend/app/models/user.ts` y `backend/app/models/task.ts`; `backend/database/` entero (ninguna migración; `schema.ts` sin regenerar); `backend/config/` (`auth.ts`, `cors.ts`, `shield.ts`); `backend/app/exceptions/handler.ts`; `frontend/src/components/ui/`; `frontend/src/index.css` (ningún token nuevo); los `package.json`/`package-lock.json` de ambos lados (**ninguna dependencia nueva**).

**Ojo con la BD**: `npm test` en `backend/` hace `truncate` sobre la misma `tmp/db.sqlite3` que el servidor de desarrollo y los e2e. **Nunca** se corren a la vez `npm test` (backend) y `npm run test:e2e` (frontend).

---

## Phase 1: Setup (línea base)

**Purpose**: Fijar el punto de partida para demostrar al final que nada fuera del alcance se movió, que nada se rompió y que la cobertura no baja.

- [ ] T001 [Repo · verificación] Anotar el commit de partida (`git rev-parse --short HEAD`; hoy `ad1dded`) como **base de todos los diffs de la valla** (T043). Desde `backend/`: `npm test` en verde y `npm run test:coverage` en verde, anotando aquí el número de tests y el % de líneas de `backend/app/` como línea base de cobertura. Desde `frontend/`: `npx playwright install chromium` si falta, y `npm run lint`, `npm run build` y `npm run test:e2e` en verde (anotar el número de tests). Comprobar que **no hay** ruta `DELETE` en `node ace list:routes` (desde `backend/`)

**Checkpoint**: Base anotada; backend y frontend en verde sin cambios.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Los helpers e2e que usa la matriz de interfaz. No dependen del backend para compilar, así que pueden escribirse en paralelo con la Phase 3.

- [ ] T002 [P] [Frontend · e2e helpers] En `frontend/e2e/support.ts`, **añadir** (sin tocar `signUp`, `signIn`, `createTask`, `expectNoSeriousA11yViolations`, `setTaskStatus`, `setTaskDueDate`, `isTasksByStatusUrl` ni `scopeBoardTo`), con su JSDoc, los tres helpers de [research §15](./research.md#15-tests-e2e-playwright): `deleteTask(request, member, taskId)` (`DELETE ${API_URL}/api/v1/tasks/{id}` con el `Bearer` del miembro; falla si el código no es `204`); `logOut(request, member)` (`POST ${API_URL}/api/v1/account/logout` con su `Bearer`; falla si no es 2xx); `getTaskStatus(request, member, taskId): Promise<number>` (devuelve el código HTTP de `GET ${API_URL}/api/v1/tasks/{id}` con su `Bearer`, para afirmar «sigue» = `200` / «ya no está» = `404`). Desde `frontend/`: `npm run build` en verde (typecheck de `e2e/` con `tsconfig.e2e.json`) — depende de T001

**Checkpoint**: Helpers compilando; ningún helper existente cambiado.

---

## Phase 3: Backend — la matriz del API, en rojo (bloques de US1, US2 y US3) ⚠️

**Purpose**: Escribir `backend/tests/functional/tasks/delete_task.spec.ts` **completo, bloque a bloque por historia**, y verlo fallar **por la razón correcta** (la ruta no existe) antes de tocar el controlador o las rutas.

**Reglas comunes a los tres bloques** ([contrato](./contracts/delete-task-api.md#matriz-de-comportamiento-definition-of-done), [research §14](./research.md#14-tests-del-backend-japa)): aislamiento con `group.each.setup(() => testUtils.db().truncate())` en cada grupo, como el resto de `tests/functional/tasks/`; miembros con `User.create` (Oscar y Ana, como `show_task.spec.ts`) y tareas con `Task.create`; peticiones con `client.delete(...)` y `.loginAs(user)` salvo que la fila diga otra vía; **«cuerpo completo»** = `assert.deepEqual(response.body(), …)` sobre el cuerpo entero (nada de `assertBodyContains`), y en el `204`, `assert.equal(response.text(), '')`; **«intacta»** = releer la tarea con `Task.findOrFail` y comparar `title`, `status`, `assigneeId`, `dueDate` y `updatedAt` con los de antes; **«recuento»** = filas de `tasks` antes y después; los ids manipulados se **construyen a partir del id real** (`` `0${task.id}` ``…), nunca con números fijos (`truncate` no reinicia la secuencia). Cada test, titulado con su número de fila y la rama del contrato (p. ej. `#8 · 401 sin sesión (R1): no borra y la tarea sigue intacta`). Un helper local `expectIntact(task)` y un `countTasks()` en el propio fichero.

- [ ] T003 [US1] [Backend · test Japa] Crear `backend/tests/functional/tasks/delete_task.spec.ts` con las utilidades comunes y el grupo `test.group('DELETE /api/v1/tasks/:id · US1 borrar una tarea, propia o ajena', …)` con las filas **#1** (tarea propia → `204`, cuerpo vacío, `await Task.find(id)` es `null`), **#2** (tarea creada y llevada por Ana, la borra Oscar → `204`, cuerpo vacío, fila fuera: R10, CA-3), **#4** (tarea en `done` con `dueDate` → `204`, fila fuera) y **#5** (tarea de Ana en `pending` y otra en `done`, Oscar borra ambas; Ana pide `GET /api/v1/tasks` y `GET /api/v1/tasks?status=done` → `200` con **cuerpo completo** que solo contiene las tareas que quedan: CA-2) — depende de T001
- [ ] T004 [US2] [Backend · test Japa] En `backend/tests/functional/tasks/delete_task.spec.ts`, grupo `… · US2 guardarraíles` con las filas **#8** (sin `Authorization` → `401` y cuerpo completo `{ errors: [{ message: 'Unauthorized access' }] }`; intacta), **#9** (`.header('Authorization', 'Bearer oat_no-es-un-token')` → `401`, mismo cuerpo; intacta), **#10** (token real obtenido con `POST /api/v1/auth/login` y revocado con `POST /api/v1/account/logout`; `DELETE` con ese token → `401`, mismo cuerpo; intacta) y **#16** (primer `DELETE` → `204`; segundo `DELETE` igual → `404` con cuerpo completo `{ errors: [{ message: 'Row not found' }] }`: R8, CA-11) — depende de T003
- [ ] T005 [US3] [Backend · test Japa] En `backend/tests/functional/tasks/delete_task.spec.ts`, grupo `… · US3 lo que pide el modelo de amenazas` con las filas: **#3** (N = 3, borra la del medio → `204`, recuento N−1, las otras dos intactas: R3); **#6** (tarea borrada **con un primer `DELETE /api/v1/tasks/:id` por la API, afirmando su `204`** —nunca con `task.delete()` en la preparación, que haría nacer la fila en verde— → `GET /api/v1/tasks/:id` da `404` con `{ errors: [{ message: 'Row not found' }] }`: R9, FR-022); **#7** (tareas A, B, C; `DELETE /tasks/:A` con `.json({ ids: [B, C] })` → `204`, solo A fuera, B y C intactas: R3); **#11** (token válido como `?token=<token>` sin cabecera → `401`, cuerpo completo; intacta: R2); **#12** (token válido en la cabecera cruda `Cookie: token=<token>`, sin `Authorization` → `401`; intacta: R2); **#13** (`.withGuard('web').loginAs(oscar)` → `401`; intacta: R2); **#14** (`DELETE /tasks/<id real + 1000>` → `404` `Row not found`, recuento igual: R4); **#15** (`/tasks/abc` → `404` `Row not found`; intacta: R4); **#17** (tareas T y U; `0${T}`, `${T}.0`, `${T}e0` y `%20${T}`, uno a uno → `404` `Row not found` en los cuatro; T y U intactas; recuento igual: R4 y [research §2](./research.md#2-el-id-se-valida-en-forma-canónica-no-se-interpreta)); **#18** (`-${T}`, `0`, `${T},${U}` y `${T}%20OR%201=1` → `404` `Row not found` en todos; T y U intactas; recuento igual: R4); **#19** (N = 3; `DELETE /api/v1/tasks` y `DELETE /api/v1/tasks?status=pending`, con sesión → `404` y recuento N, **sin** afirmar el cuerpo, que es del router; **y a continuación**, como pide literalmente R3, un `DELETE /api/v1/tasks/:id` válido → `204` y recuento exactamente N−1 — esa segunda mitad es la que hace que la fila no nazca en verde); **#20** (tarea de Ana; Oscar la borra → `204` con `response.text() === ''`; la vuelve a borrar → `404` con cuerpo **exactamente** `{ errors: [{ message: 'Row not found' }] }`, sin `stack`, nombres ni `data`: R7); **#21** (`DELETE` válido → `204` y `response.header('x-frame-options')` es `DENY`: R6, parte del API) — depende de T004
- [ ] T006 [Backend · verificación] Rojo por la razón correcta. Desde `backend/`: `node ace test functional --files=delete_task` → **21 ✗ / 0 ✓**, y cada fallo es por la **ruta inexistente**: los `204` y `401` esperados reciben el `404` del router, y los `404` esperados fallan en el **cuerpo** (el del router, no `Row not found`). En #19 la primera mitad (colección → `404`, recuento N) pasa y el test cae en el `204` de la segunda. **No valen** como rojo: errores de sintaxis o de import, un fallo al preparar datos (`User.create`, `Task.create`, login/logout) ni una aserción mal escrita; si aparece alguno, se corrige el test ahora y se repite. Si algún test sale en verde, nació en verde: se reescribe ahora. `npm run typecheck` puede quejarse del `DELETE` en el `apiClient` tipado hasta que T009 regenere el registro: es esperado y **no** se arregla tocando el test. El resto de la suite (`npm test` sin el fichero nuevo) sigue en verde como en T001. Anotar aquí el recuento y, para cada grupo, la primera línea de un fallo representativo. Punto de commit (humano): matriz del API en rojo — depende de T005

**Checkpoint**: La matriz del API existe, compila en ejecución y falla entera porque la ruta no existe.

---

## Phase 4: Backend — el `DELETE`, historia a historia, en verde

**Purpose**: Implementar lo mínimo para cada bloque. US1 trae la ruta y la acción; US3 trae la validación canónica del id, que es lo único que la ruta de US1 todavía no cumple (fila #17).

### Implementation for User Story 1 — backend

- [ ] T007 [US1] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, añadir `async destroy({ params, response }: HttpContext)`: `const task = await Task.findOrFail(params.id)`, `await task.delete()` sobre **esa instancia** (nunca `Task.query().where(...).delete()` con la entrada: R3 por construcción) y `return response.noContent()` (**sin** `serialize()`: `204` sin cuerpo, [research §1](./research.md#1-endpoint-controlador-y-acción)). Sin leer `request.body()` ni la query, sin `logger.*`, sin `auth` en la firma (no se usa: nadie guarda quién borró, R9). Un comentario JSDoc corto en el tono de las demás acciones. **Todavía sin** la validación canónica del id (llega en T011) — depende de T006
- [ ] T008 [US1] [Backend · rutas] En `backend/start/routes.ts`, **dentro** del grupo `tasks` que ya lleva `.use(middleware.auth())`, añadir `router.delete(':id', [controllers.Tasks, 'destroy'])` junto a `router.get(':id', …)`. Ninguna otra línea cambia: ni el resto de rutas, ni sus nombres, ni el `.use(...)`; nada de `router.resource` — depende de T007
- [ ] T009 [US1] [Backend · generado] Regenerar `backend/.adonisjs/` (arrancar `npm run dev` y pararlo, o correr los tests) y comprobar con `git diff backend/.adonisjs/` que el único cambio es la ruta `tasks.destroy` en el registro de Tuyau. `node ace list:routes` muestra `DELETE /api/v1/tasks/:id` (`tasks.destroy`) con middleware `auth` y el resto **idéntico** a T001 — depende de T008
- [ ] T010 [US1] [Backend · verificación] Desde `backend/`, `node ace test functional --files=delete_task`: los grupos **US1** (#1, #2, #4, #5) y **US2** (#8, #9, #10, #16) en **verde** sin haber tocado ninguna aserción. En el grupo **US3** todo verde **salvo #17**, que sigue en rojo **por la razón correcta**: SQLite convierte `0${T}`, `${T}.0`, `${T}e0` y ` ${T}` en `T` y la tarea T **se borra** (`204` donde se espera `404`). Si cae cualquier otra fila, se arregla la implementación, no el test. Anotar aquí el recuento — depende de T009

### Implementation for User Story 3 — backend

- [ ] T011 [US3] [Backend · controlador] En `TasksController.destroy` de `backend/app/controllers/tasks_controller.ts`, **antes** de tocar la BD: aceptar `params.id` solo si casa con `/^[1-9]\d*$/` y `Number.isSafeInteger(Number(params.id))`; si no, `throw new lucidErrors.E_ROW_NOT_FOUND(Task)` (import `errors as lucidErrors` de `@adonisjs/lucid`), para que el manejador existente (sin cambios) responda el mismo `404 { errors: [{ message: 'Row not found' }] }` que un id inexistente ([research §2](./research.md#2-el-id-se-valida-en-forma-canónica-no-se-interpreta)). Luego `Task.findOrFail(Number(params.id))`. Un comentario que diga **por qué** (la afinidad numérica de SQLite casaría `01`, `1.0`, `1e0`, ` 1`). No tocar `show` ni los otros controladores (la laxitud de `show`/`status`/`due-date` queda anotada para el backlog, plan.md → Re-check) — depende de T010
- [ ] T012 [Backend · verificación] Desde `backend/`: `node ace test functional --files=delete_task` → **21 ✓** sin haber editado ninguna aserción desde T006; `npm test` entero en verde (suites existentes sin editar; total = T001 + 21); `npm run typecheck` y `npm run lint` limpios; `node ace list:routes` igual que en T009. Anotar aquí el recuento. Punto de commit (humano): el `DELETE` en verde — depende de T011

**Checkpoint**: El API borra una tarea, solo una, solo con sesión por cabecera y solo con un id canónico; los e2e ya pueden escribirse contra él.

---

## Phase 5: Frontend — la matriz e2e, en rojo (bloques de US1, US2 y US3) ⚠️

**Purpose**: Escribir `frontend/e2e/delete-task.spec.ts` **completo, bloque a bloque por historia**, contra el backend real de la Phase 4, y verlo fallar **por la razón correcta** antes de tocar `frontend/src/` o `vite.config.ts`.

**Reglas comunes** ([contrato](./contracts/delete-task-ui.md#matriz-de-comportamiento-definition-of-done), [research §15](./research.md#15-tests-e2e-playwright)): cada test crea sus miembros con `signUp` y sus tareas con `createTask` y **títulos únicos** (`Date.now()` + aleatorio; BD compartida); títulos de test **exactamente** como en la tabla del contrato con el escenario de la spec (`US1-1 · DADO …, CUANDO …, ENTONCES …`); `page.clock.install()` **antes** de `goto` en todo test que abra el diálogo; «armar» = `page.clock.fastForward(500)` tras abrir; «sin dejar armar» = `page.clock.pauseAt(...)` antes del gesto; **se arma antes de toda activación deliberada** de «Cancelar», «Borrar definitivamente» o del clic fuera (en US2-1, antes de cada una de las tres cancelaciones; en US1-1, US1-3, US1-7, US1-8, US2-5, US2-6, US2-8, US3-5 y A11Y, antes de confirmar), porque desarmado el diálogo ignora esos gestos y el test fallaría o sería intermitente por una razón que no es la suya; solo US2-2 y US2-3 trabajan sin armar, porque la guarda es lo que prueban; «sin `DELETE`» = 0 peticiones con `method() === 'DELETE'` contadas con `page.on('request')`; «sigue» / «ya no está» = `getTaskStatus` como **otro** miembro (`200` / `404`); antes de pulsar «Borrar tarea», afirmar `toBeVisible()` del botón (`getByRole('button', { name: 'Borrar tarea' })`), para que el rojo sea un fallo de aserción claro y no un *timeout* de 30 s; textos esperados, literales del [contrato](./contracts/delete-task-ui.md#textos).

- [ ] T013 [US1] [Frontend · e2e] Crear `frontend/e2e/delete-task.spec.ts` con el bloque `test.describe('US1 · borrar una tarea, propia o ajena, confirmando que no hay vuelta atrás', …)` y los 8 tests **US1-1 … US1-8** de la tabla del contrato, con su «Qué comprueba». Precisiones: US1-1 desde la lista (`/tasks` → abrir la tarea → «Borrar tarea» → armar → «Borrar definitivamente»), marca en `window` antes de confirmar que sigue después (sin recargar), la tarea fuera de la pantalla **en menos de 1 s** tras confirmar (`toBeHidden({ timeout: 1_000 })` sobre su título: SC-002), ausencia en `/tasks` y en `/tasks/board`, y `getTaskStatus` → `404`; US1-2 con Oscar borrando **por la interfaz** y Ana en su propio contexto (`browser.newContext()` con la URL completa, que no hereda `baseURL`) y `signIn`; US1-3 con una tarea creada y llevada por Ana que borra Oscar, nombre accesible del diálogo con el mismo patrón que una propia y sin «Ana» ni «ajena» en el diálogo; US1-4 con `getByRole('dialog')` visible y `await dialog.evaluate((d) => d.matches(':modal'))` `true`, sin `DELETE`; US1-5 con un título de **200 caracteres** entero en el nombre accesible `¿Borrar «{título}»?` y la descripción accesible conteniendo «no se podrá recuperar»; US1-6 con `Borrar definitivamente` (`data-variant="destructive"`) y `Cancelar`, ambos visibles y con la misma altura (`boundingBox()`), y sin ningún botón «Aceptar»; US1-7 con `getByRole('status')` = «Se ha borrado «{título}».» enfocado, sin botón ni enlace «Deshacer», y tras `reload()` el aviso ya no está; US1-8 con `page.route` que hace `route.abort()` **solo** del `DELETE`, el diálogo sigue con «No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.», tras «Cancelar» la tarea sigue a la vista y `getTaskStatus` → `200`, y el aviso de borrado nunca apareció; y, en una segunda mitad del mismo test, `page.route` que responde al `DELETE` con `route.fulfill({ status: 500, json: { errors: [{ message: 'Internal Server Error' }] } })` → el diálogo muestra el **mismo** texto, «Internal Server Error» no aparece en la página y la tarea sigue (FR-007: «por cualquier motivo», sin errores técnicos crudos) — depende de T002, T012
- [ ] T014 [US2] [Frontend · e2e] En `frontend/e2e/delete-task.spec.ts`, bloque `test.describe('US2 · los guardarraíles: nada se borra sin querer', …)` con los 8 tests **US2-1 … US2-8** de la tabla del contrato **más** el test **`A11Y`** (SC-008, FR-016: `expectNoSeriousA11yViolations` con el diálogo abierto, con el diálogo en `error` —`DELETE` abortado— y en la lista con el aviso de borrado). Precisiones: US2-1 en un solo test con las tres cancelaciones (botón; Escape; clic con `page.mouse.click` en una esquina del *backdrop*, fuera de la caja del diálogo), cada vez diálogo cerrado, foco en «Borrar tarea» (`toBeFocused`), título/responsable/estado/fecha iguales que antes y sin `DELETE`; US2-2 con el reloj en pausa, abrir con el teclado, `toBeFocused` en «Cancelar», `Enter` → sin `DELETE` y tarea a la vista; US2-3 con el reloj en pausa: `dblclick` en «Borrar tarea» → diálogo abierto y sin `DELETE`; Escape; foco en «Borrar tarea», `Enter`, `Enter` → diálogo abierto y sin `DELETE`; US2-4 afirma primero que en `/tasks` y en `/tasks/board` no hay ningún botón cuyo nombre empiece por «Borrar» (`getByRole('button', { name: /^Borrar/ })` con `toHaveCount(0)`) y que el estado se cambia con el `<select>` de la fila, y **después** abre la tarea y afirma que «Borrar tarea» está ahí (la tercera interacción; esta segunda mitad es la que lo hace nacer en rojo); US2-5 en un solo test con dos mitades: (a) sin sesión, `goto('/tasks/{id}')` → `/login` y sin «Borrar tarea»; (b) con sesión, diálogo abierto, `logOut` por la API, armar y confirmar → «Tu sesión ha caducado. Vuelve a iniciar sesión.» dentro del diálogo y `getTaskStatus` (con otro miembro) → `200`; US2-6 con Oscar en la tarea abierta, Ana la borra con `deleteTask` por la API, Oscar confirma → «Esta tarea ya no existe» + «Puede que alguien la haya borrado.» en un `Alert` **no** destructivo, sin «Algo ha ido mal», la tarea ya no se muestra y el foco en «Volver a la lista»; US2-7: en la lista, pasar la tarea a «Hecho» con su `<select>` no abre ningún `dialog` (`toHaveCount(0)`) ni emite `DELETE`, la tarea sale de la vista por defecto, con el filtro «Hecho» sigue y se abre, y **abierta ofrece «Borrar tarea»** (el borrado es el otro camino; sin esta última aserción el test nacería en verde); US2-8 solo teclado con el recorrido exacto del contrato (`Tab` hasta la tarea, `Enter`, `Tab` hasta «Borrar tarea», `Enter` → foco en «Cancelar»; `Tab` → «Borrar definitivamente»; `Tab` → «Cancelar»; `Shift+Tab` → «Borrar definitivamente»; Escape → foco en «Borrar tarea»; reabrir, armar, `Tab`, `Enter` → en la lista con el foco en el aviso), con `toBeFocused` en cada paso, en los botones además `:focus-visible` (`locator.evaluate((el) => el.matches(':focus-visible'))` → `true`), y ningún clic; que el anillo se **vea** de verdad no lo comprueba ni esto ni axe: queda en la validación manual (T041) — depende de T013
- [ ] T015 [US3] [Frontend · e2e] En `frontend/e2e/delete-task.spec.ts`, bloque `test.describe('US3 · lo que pide el modelo de amenazas', …)` con **US3-4** (`page.setContent('<iframe src="http://localhost:5173/tasks"></iframe>')` → dentro de `page.frameLocator('iframe')` no aparece ningún `heading`; afirmar con un `expect.poll`/`toHaveCount(0)` tras esperar el `load` del marco, no con un *timeout* fijo) y **US3-5** (Oscar —con un `fullName` único y reconocible— borra por la interfaz una tarea de Ana: en la página con el aviso de borrado no aparece el `fullName` de Oscar; después Oscar borra otra tarea que Ana tiene abierta en su contexto y Ana confirma su borrado → en el «ya no existe» que ve Ana no aparece el nombre de Oscar). Los escenarios solo de servidor (US3-1, US3-2, US3-3, US3-6) viven en la matriz del API (T005) — depende de T014
- [ ] T016 [Frontend · verificación] Rojo por la razón correcta. Desde `frontend/`: `npm run build` en verde (la matriz **compila**; un error de tipos no es un rojo válido). Con el backend de la Phase 4 (si hay un `node ace serve` arrancado de antes de T008, **reiniciarlo**: Playwright reutiliza el que encuentre), `npx playwright test e2e/delete-task.spec.ts` → **19 ✗ / 0 ✓**, y cada fallo en la **primera aserción sobre el borrado**: «Borrar tarea» no encontrado en la tarea abierta. En US2-4, US2-5 y US2-7 las primeras mitades (ausencia en lista/tablero, `/login` sin sesión, «Hecho» sin diálogo) pasan y el test cae en «Borrar tarea». US3-4 cae porque el marco **sí** pinta la aplicación (Vite no manda cabeceras). **No valen** como rojo: un fallo en `signUp`/`signIn`/`createTask`/`deleteTask`/`logOut`/`getTaskStatus`, un selector mal escrito, un problema con `page.clock` ni un *timeout* antes de llegar a la tarea abierta; si aparece alguno, se corrige el test o el helper ahora y se repite. Si algún test sale en verde, nació en verde: se reescribe ahora. Los e2e existentes siguen en verde. Anotar el recuento y, por bloque, la primera línea de un fallo representativo. Punto de commit (humano): helpers + matriz e2e en rojo — depende de T015

**Checkpoint**: Las dos matrices existen y se vieron en rojo por la razón correcta. A partir de aquí ninguna aserción se toca.

---

## Phase 6: User Story 1 - Borrar una tarea, propia o ajena, confirmando que no hay vuelta atrás (Priority: P1) 🎯 MVP

**Goal**: Desde la tarea abierta, «Borrar tarea» abre una pregunta modal que nombra la tarea y dice que no hay vuelta atrás; «Borrar definitivamente» la borra de verdad para todo el equipo y devuelve a la vista de la que se vino con «Se ha borrado «…».»; si falla la conexión, la tarea sigue y se explica.

**Independent Test**: `npx playwright test e2e/delete-task.spec.ts -g "US1-"` en verde (8 tests) y Japa #1, #2, #4, #5 en verde (T010).

- [ ] T017 [US1] [Frontend · lib] Leer `DESIGN.md` antes de tocar ninguna pantalla (Principio VI). En `frontend/src/lib/api.ts`: ampliar `RequestOptions.method` con `'DELETE'` y añadir `export function deleteTask(id: number, token: string): Promise<void>` sobre `request` (`DELETE /api/v1/tasks/${id}` con el `token`), que resuelve a `undefined` con el `204` (el `response.json().catch(() => null)` existente ya tolera el cuerpo vacío; comprobarlo) y encadena `.catch(taskNotFound)` como `getTask` y `setDueDate`, de modo que un `404` sea `ApiError(404)` con «Puede que alguien la haya borrado.». Con su JSDoc. Ninguna función existente cambia — depende de T016
- [ ] T018 [P] [US1] [Frontend · componente] Crear `frontend/src/components/tasks/delete-task-dialog.tsx` con `DeleteTaskDialog({ task: Pick<Task, 'id' | 'title'>, token, open, onCancel, onDeleted })` sobre un **`<dialog>` nativo** abierto con `showModal()` cuando `open` pasa a `true` y cerrado con `close()` cuando pasa a `false` (React es la única fuente de verdad: el evento `cancel` hace `preventDefault()` y llama a `onCancel`). Escuchar también el evento `close`: si el navegador cierra el `<dialog>` por su cuenta con `open` todavía a `true` (Chromium no deja cancelar un segundo Escape sin activación de usuario entre medias), en `deleting` se vuelve a abrir con `showModal()` y en cualquier otro estado cuenta como `onCancel`, como dice la tabla de estados del contrato. Estructura del [contrato](./contracts/delete-task-ui.md#estructura-accesible-del-diálogo): `aria-labelledby="delete-task-title"` → `<h2>` «¿Borrar «{título}»?» con `wrap-break-word`; `aria-describedby="delete-task-description"` → «Se borrará para todo el equipo y no se podrá recuperar: no hay papelera ni forma de deshacerlo.»; `<p role="alert">` solo si falló; `Button variant="outline"` «Cancelar» **primero** y `Button variant="destructive"` «Borrar definitivamente», **mismo `size`**. Todo el contenido dentro de un `div` con `p-6` (el `<dialog>` sin padding); clases del [diseño](./contracts/delete-task-ui.md#diseño): `m-auto bg-card text-card-foreground border rounded-xl max-w-md w-[calc(100%-2rem)] backdrop:bg-background/80`, contenido con scroll si no cabe; **solo tokens semánticos**, ningún color de paleta, hex ni arbitrario. Confirmar: **una sola petición en vuelo** (un `ref`), el botón dice «Borrando…» y, mientras dura, «Cancelar» y el evento `cancel` se ignoran; `204` → `onDeleted()`; cualquier fallo → estado `error` con «No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.», el diálogo sigue abierto y se puede reintentar o cancelar. Sin actualización optimista. Ningún texto nombra a nadie. (La guarda, el foco y el clic fuera son de US2) — depende de T017, T040
- [ ] T019 [P] [US1] [Frontend · componente] Crear `frontend/src/components/tasks/task-deleted-notice.tsx` con `TaskDeletedNotice()`: lee `location.state.deletedTaskTitle` **una sola vez** al montar en un `ref` (mismo patrón que `focusTaskId` en `frontend/src/pages/tasks-page.tsx`), y lo borra del historial con `navigate(location, { replace: true, state: null })` para que recargar no lo repita; si había título, pinta `<p role="status" tabIndex={-1} className="text-muted-foreground …">Se ha borrado «{título}».</p>` y le da el foco al montar ([research §11](./research.md#11-el-aviso-de-tarea-borrada-en-la-lista-y-en-el-tablero)). Sin «Deshacer», sin enlaces, sin nombres de persona; si no había título, no pinta nada — depende de T016
- [ ] T020 [US1] [Frontend · página] En `frontend/src/pages/task-page.tsx`: con la tarea **cargada** (no en `not-found` ni en `error`), botón `Button variant="destructive"` «Borrar tarea» en el pie de la `Card` de la tarea, separado de los datos y de la fecha; abre `DeleteTaskDialog` con la tarea y el token de `useAuth()` (solo se **usa**; `frontend/src/auth/` no se toca). `onCancel` → cierra. `onDeleted` → `navigate(destino, { replace: true, state: { deletedTaskTitle: task.title } })`, con destino `/tasks/board` si `location.state.from === 'board'` (el mismo criterio que `BackToList`) y `/tasks` si no ([research §10](./research.md#10-qué-pasa-al-confirmar)) — depende de T018
- [ ] T021 [P] [US1] [Frontend · página] En `frontend/src/pages/tasks-page.tsx`, pintar `<TaskDeletedNotice />` arriba de la vista, sin tocar el filtro, la lista ni la lógica de `focusTaskId` — depende de T019
- [ ] T022 [P] [US1] [Frontend · página] En `frontend/src/pages/board-page.tsx`, pintar `<TaskDeletedNotice />` arriba del tablero, sin tocar columnas, arrastre ni `focusTaskId` — depende de T019
- [ ] T023 [US1] [Frontend · verificación] Desde `frontend/`: `npm run build` y `npm run lint` en verde; `npx playwright test e2e/delete-task.spec.ts -g "US1-"` → **8 ✓** sin haber tocado ninguna aserción. Correr el fichero entero y anotar qué tests de US2/US3 siguen en rojo y cuáles ya pasan (los que pasen se vieron en rojo en T016: no nacen en verde). Los e2e existentes, en verde. Punto de commit (humano): US1 — depende de T020, T021, T022
- [ ] T024 [US1] [Repo · mitigación R10 · Roles planos de verdad (E-1, CA-3)] Comprobar que R10 queda cubierta por sus tests, ambos en verde: Japa **#2** (Oscar borra una tarea creada y llevada por Ana → `204`) y e2e **US1-3** (mismo diálogo que con una propia, sin mencionar a Ana ni «ajena»). Revisar en el diff que `TasksController.destroy` no compara `assigneeId` ni el usuario autenticado, y que no existe ningún `confirm`/flag en el cuerpo de la petición (la «confirmación en el servidor» que el modelo descarta). Anotar aquí el resultado — depende de T023

**Checkpoint**: MVP. Se puede borrar cualquier tarea con una confirmación que nombra la tarea y avisa de la irreversibilidad.

---

## Phase 7: User Story 2 - Los guardarraíles: nada se borra sin querer (Priority: P2)

**Goal**: Cancelar (botón, Escape, clic fuera) no toca nada y devuelve el foco; el foco nace en «Cancelar»; un doble clic o un Enter de más no confirman; el foco no sale del diálogo; borrar lo ya borrado se explica sin parecer un fallo; con la sesión cerrada no se borra nada.

**Independent Test**: `npx playwright test e2e/delete-task.spec.ts -g "US2-|A11Y"` en verde (9 tests) y Japa #8, #9, #10, #16 en verde (T010).

- [ ] T025 [US2] [Frontend · componente] En `frontend/src/components/tasks/delete-task-dialog.tsx`, la **guarda contra la doble activación** ([research §9](./research.md#9-un-doble-clic-o-un-enter-de-más-no-confirman-fr-010)): `const CONFIRM_GUARD_MS = 500` con un comentario que diga por qué; al abrir, el diálogo nace **desarmado** y un `setTimeout` (no `performance.now()`, para que `page.clock` lo controle) pone `armed = true`, limpiado al cerrar o desmontar. Desarmado, las activaciones de «Cancelar», «Borrar definitivamente» y el clic fuera **no hacen nada**; **Escape cancela siempre** (salvo en `deleting`). Los botones **no** se deshabilitan (perderían el foco inicial) — depende de T023
- [ ] T026 [US2] [Frontend · componente] En `frontend/src/components/tasks/delete-task-dialog.tsx`: (1) **foco inicial** en «Cancelar» con `cancelRef.current.focus()` explícito tras `showModal()` (no `autoFocus`); (2) **foco atrapado**: `onKeyDown` en el diálogo, `Tab` en el último control → al primero y `Shift+Tab` en el primero → al último; (3) **clic fuera cancela**: un `click` cuyo `target` es el propio `<dialog>` (solo puede venir del *backdrop*) llama a `onCancel` si está armado y no está en `deleting`; (4) **sesión cerrada**: si el fallo es `ApiError` con `status === 401`, el error del diálogo es su `message` («Tu sesión ha caducado. Vuelve a iniciar sesión.»); (5) nueva prop `onNotFound(error: ApiError)`: un `ApiError` con `status === 404` cierra el flujo llamando a `onNotFound` en vez de pasar a `error`. Tabla de estados del [contrato](./contracts/delete-task-ui.md#estados-del-diálogo), literal — depende de T025
- [ ] T027 [US2] [Frontend · página] En `frontend/src/pages/task-page.tsx`: (1) guardar un `ref` al botón «Borrar tarea» y, al cerrar el diálogo **sin borrar** (`onCancel`), devolverle el foco; (2) pasar `onNotFound` → cerrar el diálogo y poner la página en el estado `not-found` que **ya existe** (`{ key, kind: 'not-found', error }`), que pinta el `Alert` por defecto «Esta tarea ya no existe» + «Puede que alguien la haya borrado.»; el foco va a «Volver a la lista» / «Volver al tablero» (`BackToList`). Sin textos nuevos — depende de T026
- [ ] T028 [US2] [Frontend · verificación] Desde `frontend/`: `npm run build` y `npm run lint` en verde; `npx playwright test e2e/delete-task.spec.ts -g "US1-|US2-|A11Y"` → **17 ✓** sin haber tocado ninguna aserción. Los e2e existentes, en verde. Punto de commit (humano): US2 — depende de T027
- [ ] T029 [US2] [Repo · mitigación R1 · Solo con sesión (S-1, CA-10)] Comprobar que R1 queda cubierta, en verde: Japa **#8** (sin `Authorization`), **#9** (token inventado) y **#10** (token revocado por logout) → `401` y la tarea intacta; e2e **US2-5** (sin sesión no hay «Borrar tarea»; con la sesión cerrada, confirmar no borra). Revisar que la ruta está **dentro** del grupo con `middleware.auth()` (`node ace list:routes`) y que `backend/app/middleware/` y `frontend/src/auth/` no tienen diff respecto a la base de T001. Anotar aquí el resultado — depende de T028
- [ ] T030 [US2] [Repo · mitigación R5 · Confirmación que no se dispara sola (T-3, CA-4…CA-7)] Comprobar que R5 queda cubierta, en verde, contando peticiones `DELETE`: e2e **US1-4** (modal), **US1-5** (título e irreversibilidad), **US1-6** (opciones claras, destructiva distinguida), **US2-1** (botón, Escape, clic fuera: sin `DELETE`), **US2-2** (Enter recién abierto: sin `DELETE`), **US2-3** (doble clic y doble tecla: sin `DELETE`), **US2-4** (borrar no comparte control ni posición con el estado; 3 interacciones frente a 2) y **US2-8** (todo con el teclado, foco atrapado). Revisar en el diff que `CONFIRM_GUARD_MS` y el foco inicial en «Cancelar» están en `delete-task-dialog.tsx`. Anotar aquí el resultado — depende de T028
- [ ] T031 [US2] [Repo · mitigación R8 · Borrar lo ya borrado (D-1, CA-11)] Comprobar que R8 queda cubierta, en verde: Japa **#16** (segundo `DELETE` → `404` `Row not found`) y e2e **US2-6** («Esta tarea ya no existe» en un `Alert` no destructivo, sin «Algo ha ido mal», y la tarea fuera de la vista). Anotar aquí el resultado — depende de T028

**Checkpoint**: US1 y US2 funcionan y se prueban por separado; ningún gesto accidental completa un borrado.

---

## Phase 8: User Story 3 - Lo que pide el modelo de amenazas y no está en la historia (Priority: P3)

**Goal**: Que el borrado aguante el abuso: una petición borra como mucho una tarea, un id manipulado no borra nada, la credencial solo vale en la cabecera, la aplicación no se deja incrustar, ninguna respuesta filtra datos ni autor, y el borrado es real y anónimo. Casi todo es del backend y ya está en verde desde T012; aquí queda la parte de interfaz (R6) y la tarea de cada mitigación.

**Independent Test**: `npx playwright test e2e/delete-task.spec.ts -g "US3-"` en verde (2 tests) y el grupo US3 de la matriz del API en verde (T012).

- [ ] T032 [US3] [Frontend · config] En `frontend/vite.config.ts`, añadir `server.headers` **y** `preview.headers` con exactamente `'X-Frame-Options': 'DENY'` y `'Content-Security-Policy': "frame-ancestors 'none'"` (nada más en esa CSP: no restringe scripts ni estilos, [research §7](./research.md#7-que-la-aplicación-no-se-pueda-incrustar)), con un comentario corto que diga que el servidor de producción lo comprueba el despliegue. Ningún cambio en `index.html` (en `<meta>` estas directivas se ignoran) — depende de T028
- [ ] T033 [US3] [Frontend · verificación] Reiniciar el servidor de Vite si estaba arrancado (las cabeceras se leen al arrancar). Desde `frontend/`: `npm run build` y `npm run lint` en verde; `curl -sI http://localhost:5173 | grep -iE 'x-frame-options|content-security-policy'` muestra las dos cabeceras; `npx playwright test e2e/delete-task.spec.ts` → **19 ✓** sin haber tocado ninguna aserción; `npm run test:e2e` entero en verde. Punto de commit (humano): US3 — depende de T032
- [ ] T034 [P] [US3] [Repo · mitigación R2 · El permiso solo por la vía actual (T-5)] Comprobar que R2 queda cubierta, en verde: Japa **#11** (`?token=`), **#12** (cookie) y **#13** (sesión del guard `web`) → `401` y la tarea intacta. Revisar que `backend/config/auth.ts` (guard por defecto `api`, solo `Authorization: Bearer`) y `backend/config/shield.ts` no tienen diff, y que `deleteTask` de `frontend/src/lib/api.ts` manda el token solo en la cabecera. Anotar aquí el resultado — depende de T033
- [ ] T035 [P] [US3] [Repo · mitigación R3 · Una petición, una tarea (T-1)] Comprobar que R3 queda cubierta, en verde: Japa **#3** (N → N−1, las demás intactas), **#7** (un cuerpo `{ ids }` no amplía el borrado) y **#19** (`DELETE /api/v1/tasks`, con y sin `?status`, no borra nada; un `DELETE /:id` válido deja N−1). Revisar que `node ace list:routes` tiene **un solo** `DELETE` (`/api/v1/tasks/:id`) y que `destroy` borra **la instancia** (`task.delete()`), sin `Task.query()…delete()`. Anotar aquí el resultado — depende de T033
- [ ] T036 [P] [US3] [Repo · mitigación R4 · La referencia no se interpreta (T-2)] Comprobar que R4 queda cubierta, en verde: Japa **#14** (inexistente), **#15** (`abc`), **#17** (`0T`, `T.0`, `Te0`, ` T`: formas que SQLite casaría) y **#18** (negativo, `0`, compuesto, con SQL) → `404` `Row not found` idéntico y ninguna tarea tocada. Revisar en el diff la validación canónica de T011 y su comentario. Anotar aquí el resultado — depende de T033
- [ ] T037 [P] [US3] [Repo · mitigación R6 · No se puede incrustar (T-4)] Comprobar que R6 queda cubierta en lo que depende del repo, en verde: Japa **#21** (`x-frame-options: DENY` en la respuesta del `DELETE`) y e2e **US3-4** (el `<iframe>` no pinta la SPA). Anotar que la parte del servidor de producción queda para la comprobación del despliegue (spec, FR-020; modelo de amenazas §5) — depende de T033
- [ ] T038 [P] [US3] [Repo · mitigación R7 · Sin fugas ni atribución (I-1, RNF-7)] Comprobar que R7 queda cubierta, en verde: Japa **#20** (`204` sin cuerpo; `404` exactamente `{ errors: [{ message: 'Row not found' }] }`, sin `stack` ni datos), las filas `401`/`404` de **#8–#18** con cuerpo completo (`deepEqual`), y e2e **US3-5** (ningún mensaje de la interfaz nombra a quien borró). Revisar que ningún texto nuevo de `delete-task-dialog.tsx`, `task-deleted-notice.tsx` ni `task-page.tsx` interpola un nombre de persona. Anotar aquí el resultado — depende de T033
- [ ] T039 [P] [US3] [Repo · mitigación R9 · Borrado real y anónimo (R-1, CA-8, RNF-7)] Comprobar que R9 queda cubierta: Japa **#1** (`Task.find(id)` es `null` tras el `204`: la fila no existe) y **#6** (`GET /api/v1/tasks/:id` → `404`) en verde; y **revisión del diff**, que Japa no puede automatizar: `git diff <base T001> -- backend/database/` vacío (ninguna migración, ninguna columna `deleted_*`, `schema.ts` sin regenerar), `git status --porcelain backend/database/` vacío, ningún `logger.` en `TasksController.destroy` (`grep -n "logger" backend/app/controllers/tasks_controller.ts`), y ninguna tabla, columna ni log nuevo con el autor. Anotar aquí el resultado — depende de T033

**Checkpoint**: Las tres historias funcionan y cada mitigación R1–R10 tiene su test en verde (o, en R9, su revisión del diff).

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: El patrón de diseño (T040, que se ejecuta antes, tras T016: ver su dependencia), la validación manual y el cierre.

- [ ] T040 [P] [Docs · diseño] En `DESIGN.md`, sección «Components», añadir el patrón **«Confirmación destructiva»** ([research §16](./research.md#16-diseño)), sin valores ni tokens nuevos: pregunta modal que nombra el objeto y dice que no hay vuelta atrás; opción destructiva con `Button variant="destructive"` que dice la acción («Borrar definitivamente», no «Aceptar»); «Cancelar» `outline` del mismo tamaño, primera y con el foco inicial; *backdrop* `bg-background/80`; guarda de 500 ms contra la doble activación; Escape y clic fuera cancelan; sin deshacer. `frontend/src/index.css` **sin diff**. Va **antes** que el diálogo (T018), no al final: DESIGN.md es la fuente única del diseño (Principio VI) y el patrón tiene que estar escrito antes de que el código lo pinte, también en el punto de commit de US1 (T023) — depende de T016
- [ ] T041 [Repo · validación manual] Recorrer `quickstart.md` §2 y §4 (pasos 1 a 9) con `npm run dev` en `backend/` y en `frontend/`, incluidos el recorrido solo con teclado (foco **visible** en cada paso: axe no lo comprueba), el título muy largo en la pregunta, borrar la última tarea de una columna del tablero (estado vacío sin errores) y `curl -I localhost:5173`. Cronometrar además SC-002: desde que se decide borrar (en la lista) hasta confirmar, menos de 10 s; el e2e US1-1 ya fija el < 1 s de salida de la pantalla. Anotar aquí cualquier diferencia con los contratos — depende de T033, T040
- [ ] T042 [Repo · revisión] Comprobar que `specs/007-borrar-tarea/spec.md`, `plan.md` y los contratos siguen describiendo lo construido (textos, códigos, ficheros) y que la sección «Del modelo de amenazas a la spec» cuadra con las tareas T024 y T029–T039 (R1–R10, una tarea cada una). Las decisiones de producto pendientes (quién borró, papelera, alta abierta, PA-8) **no** se resuelven aquí — depende de T041
- [ ] T043 [Repo · cierre] **Tarea final**, en este orden; cada paso en verde antes del siguiente:
  1. **Valla intacta** respecto a la base de T001, incluidos los ficheros sin seguimiento (`git status --porcelain`): `git diff --stat <base> -- frontend/src/auth/` **vacío**; `git diff --stat <base> -- backend/app/middleware/` **vacío** (en particular `auth_middleware.ts` y `silent_auth_middleware.ts`); `git diff --stat <base> -- backend/app/validators/user.ts` **vacío**. Y el resto de la valla de `quickstart.md` §5, también vacío: controladores de auth, `backend/app/models/`, `backend/database/`, `backend/config/`, `backend/app/exceptions/handler.ts`, `frontend/src/components/ui/`, `frontend/src/index.css` y `'*/package.json' '*/package-lock.json'`. Los tests existentes sin diff (`git diff <base> -- backend/tests/ frontend/e2e/` solo muestra los dos ficheros nuevos y los añadidos de `support.ts`). Los únicos ficheros tocados son los de Path Conventions, más este `tasks.md`.
  2. **Backend** (desde `backend/`, sin e2e corriendo a la vez): `npm test` en verde (total = T001 + 21) y `npm run test:coverage` en verde, con el % de líneas de `backend/app/` **no menor** que el de T001; `npm run lint` y `npm run typecheck` limpios.
  3. **Frontend** (desde `frontend/`, sin `npm test` del backend corriendo a la vez): `npm run format`, y después, sobre el código ya formateado, `npm run build`, `npm run lint` y `npm run test:e2e` en verde (total = T001 + 19). Si `format` tocó algo fuera del alcance, se revierte.
  4. **Revisión adversarial**: lanzar el subagente `adversarial-reviewer` sobre el **diff completo** (`git diff <base>` + ficheros sin seguimiento; **no hay PR**) contra `specs/007-borrar-tarea/spec.md`, `plan.md`, los dos contratos, `docs/security/threat-model-e2-10.md`, `BOUNDARIES.md` y la constitución v1.2.0. Cada hallazgo bloqueante se corrige y se repiten los pasos 1 a 3; los no bloqueantes que no se corrijan se anotan aquí con su motivo.
  5. **No hacer commit, ni push, ni abrir ningún PR.** Dejar el árbol de trabajo con los cambios sin commitear y pedir revisión humana — depende de T042

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001. Puede ir en paralelo con la Phase 3 (archivo distinto, otra capa).
- **Matriz del API en rojo (Phase 3)**: depende de T001. Bloquea toda la implementación del backend.
- **Backend en verde (Phase 4)**: depende de T006. Dentro, US1 (T007–T010) antes que US3 (T011–T012): la validación canónica se añade a la acción que crea US1.
- **Matriz e2e en rojo (Phase 5)**: depende de T002 y T012 (los e2e usan el `DELETE` real). Bloquea toda la implementación del frontend.
- **US1 (Phase 6)**: depende de T016.
- **US2 (Phase 7)**: depende de T023 (refina el diálogo y la página de US1).
- **US3 (Phase 8)**: T032 depende de T028 solo para no tocar el frontend con dos historias a medias; técnicamente `vite.config.ts` es independiente y podría ir tras T016.
- **Polish (Phase 9)**: T040 (DESIGN.md) depende solo de T016 y bloquea T018; T041–T043 dependen de T033 y de T040. T043 es siempre la última.

### User Story Dependencies

- **US1 (P1)**: tras las dos fases de rojo. Es el MVP.
- **US2 (P2)**: se verifica por separado, pero su implementación modifica `delete-task-dialog.tsx` y `task-page.tsx` de US1.
- **US3 (P3)**: su backend (T011) depende de la acción de US1 (T007); su frontend (T032) es independiente.

### Within Each User Story

- Tests escritos y vistos en rojo **antes** de la implementación de su capa (Phases 3 y 5); ninguna aserción se edita después.
- Backend: controlador → ruta → registro regenerado → verde.
- Frontend: `lib/api.ts` → componentes → páginas → verde → tareas de mitigación.

### Parallel Opportunities

- T002 (helpers e2e) en paralelo con T003–T006 (matriz del API).
- T018 (diálogo) y T019 (aviso), archivos distintos; después T021 y T022 (lista y tablero) en paralelo entre sí.
- T034–T039 (mitigaciones de US3), todas de solo lectura/verificación, en paralelo entre sí.
- T040 (DESIGN.md) en paralelo con T017 y T019, tras T016.
- **No** en paralelo: tareas sobre el mismo fichero (T003–T005; T007 y T011; T013–T015; T018, T025, T026; T020 y T027), ni `npm test` del backend con `npm run test:e2e`.

---

## Parallel Example: User Story 1

```bash
# Tras T017 (deleteTask en lib/api.ts):
Task: "T018 Crear DeleteTaskDialog en frontend/src/components/tasks/delete-task-dialog.tsx"
Task: "T019 Crear TaskDeletedNotice en frontend/src/components/tasks/task-deleted-notice.tsx"

# Tras T019:
Task: "T021 Pintar TaskDeletedNotice en frontend/src/pages/tasks-page.tsx"
Task: "T022 Pintar TaskDeletedNotice en frontend/src/pages/board-page.tsx"
```

## Parallel Example: User Story 3

```bash
# Tras T033, las seis mitigaciones se verifican a la vez:
Task: "T034 R2 · Japa #11, #12, #13"
Task: "T035 R3 · Japa #3, #7, #19"
Task: "T036 R4 · Japa #14, #15, #17, #18"
Task: "T037 R6 · Japa #21 + e2e US3-4"
Task: "T038 R7 · Japa #20 + e2e US3-5"
Task: "T039 R9 · Japa #1, #6 + revisión del diff"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (base) y Phase 2 (helpers).
2. Phase 3: matriz del API en rojo → Phase 4 hasta T010 (ruta y acción; todo verde salvo #17).
3. Phase 5: matriz e2e en rojo.
4. Phase 6: US1.
5. **STOP and VALIDATE**: US1 en verde por sí sola. Ojo: el MVP **no se entrega** sin T011 (la validación canónica): sin ella, `DELETE /tasks/01` borra la tarea 1. El corte mínimo entregable es US1 + T011–T012.

### Incremental Delivery

1. Base + rojo del API → backend US1 → backend US3 → API completo.
2. Rojo e2e → US1 (MVP de interfaz) → US2 (guardarraíles) → US3 (anti-framing).
3. Cada historia cierra con las tareas de sus mitigaciones (R10; R1, R5, R8; R2, R3, R4, R6, R7, R9).
4. Polish → validación manual (DESIGN.md ya se escribió en T040, antes del diálogo), cierre con valla, suites, cobertura, formato y `adversarial-reviewer`. Sin commits, push ni PR.

---

## Notes

- [P] = archivo distinto, sin dependencias pendientes.
- [Story] traza cada tarea a su historia; las mitigaciones R1–R10 llevan la historia que las recoge en «Del modelo de amenazas a la spec».
- Una tarea de verificación «anota aquí» su resultado bajo la propia tarea, como en `specs/006-tablero/tasks.md`.
- El rojo válido es el de la razón correcta; un rojo por sintaxis, import, helper o selector se corrige antes de seguir.
- Evitar: rediseñar lo que fijan los contratos, editar aserciones para pasar a verde, tocar la valla, añadir dependencias, correr las dos suites a la vez.

---

## Pendiente de decisión humana: hallazgos BAJOS de `/speckit-analyze` (2026-10-13)

Las correcciones CRÍTICAS (ninguna), ALTAS y MEDIAS del análisis ya están aplicadas en `tasks.md`, `contracts/` y `quickstart.md`. Estas siete, de severidad BAJA, **no** se han aplicado: no cambian el orden de ejecución ni hacen que ninguna tarea falle, y decidir si entran le toca a la persona que revisa.

| ID | Dónde | Hallazgo | Propuesta |
|---|---|---|---|
| L1 | spec.md FR-002 · T014 (US2-7) | FR-002 pide la confirmación «también para tareas … en «Hecho»», pero ningún e2e abre el diálogo sobre una tarea en «Hecho»: US2-7 acaba afirmando que el botón existe, no que la pregunta aparezca. | Que US2-7 pulse también «Borrar tarea» y afirme el `dialog` (sin confirmar), o aceptar que la confirmación es la misma para cualquier estado por construcción. |
| L2 | spec.md Edge Cases · T041 | «Borrar la última tarea de una columna → estado vacío sin errores» solo se comprueba a mano. | Dejarlo manual (es un caso límite, no un escenario de aceptación) o añadir una aserción a US1-1 sobre el estado vacío del tablero. |
| L3 | spec.md US1-7 / FR-006 · research §11 | La spec dice «se le indica **brevemente**»; el aviso diseñado es un `role="status"` que se queda hasta salir de la vista. «Brevemente» es ambiguo (¿texto corto o aviso efímero?). | Precisar en la spec que «brevemente» es un texto corto, no un aviso que desaparece solo (research §11 descarta el toast a propósito). |
| L4 | spec.md US2-3 | «la tecla que activa «Borrar»» frente a «Borrar tarea» en el resto de artefactos: deriva de nombre menor. | Escribir «Borrar tarea» o «la acción de pedir borrar», como en FR-010. |
| L5 | spec.md FR-011, FR-012, SC-003 | Solapamiento: FR-012 dice que cumple FR-011 «por construcción», y SC-003 repite FR-011. | Dejarlo (la redundancia es explícita y trazada) o fundir SC-003 en FR-011. |
| L6 | spec.md Assumptions | La spec cita rutas del repo (`specs/002-cambiar-estado/`, `specs/003-abrir-tarea/`). No es CÓMO (Principio I), pero roza el «sin detalles técnicos» del checklist. | Citar las historias (E2-4, E2-5) en vez de las carpetas. |
| L7 | contracts/delete-task-api.md #21 · T037 | `X-Frame-Options: DENY` lo manda `shield` en todas las respuestas, no el `DELETE`: la fila #21 es una guarda de regresión del API entero, no algo que este cambio construya. | Dejarla y anotarlo así en T037, o moverla a una comprobación de configuración. |
