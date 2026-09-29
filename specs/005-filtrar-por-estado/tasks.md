---

description: "Task list for Filtrar la lista por estado"
---

# Tasks: Filtrar la lista por estado

**Input**: Design documents from `/specs/005-filtrar-por-estado/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/task-list-api.md](./contracts/task-list-api.md), [contracts/task-list-ui.md](./contracts/task-list-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. `GET /api/v1/tasks` con `status` lleva su **matriz de comportamiento completa** (principio II de la constitución v1.1.0, [contrato](./contracts/task-list-api.md#matriz-de-comportamiento-definition-of-done)) en un fichero nuevo, `backend/tests/functional/tasks/list_tasks_by_status.spec.ts`: un test por escenario de la User Story 1, titulado como el escenario, escrito y ejecutado en **rojo** en una tarea propia (T006) **antes** de cualquier implementación. Todas las aserciones de cuerpo son `assert.deepEqual(response.body(), …)` sobre el cuerpo **entero**; nada de `assertBodyContains` ni `containsSubset`. `list_tasks.spec.ts`, `create_task.spec.ts` y `update_task_due_date.spec.ts` **no se editan**; de `show_task.spec.ts`, `update_task_status.spec.ts` y `task_overdue.spec.ts` cambia **solo el helper**, antes y verde→verde (research §6). El frontend no tiene runner de tests (fuera de alcance, sin dependencias nuevas): se verifica con `npm run lint`, `npm run build` y a mano con `quickstart.md`.

**Organization**: Tareas agrupadas por historia (US1/US2 de `spec.md`), en orden de dependencias: línea base → helpers de tests existentes → tests nuevos en rojo → modelo ∥ validador → controlador → código generado → verde → `lib/api.ts` → layout del filtro → rutas → control → página. Cada tarea nombra la capa y el archivo que toca. Ninguna tarea rediseña lo que `plan.md`/`research.md`/`data-model.md`/`contracts/` ya decidieron: solo lo ejecuta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React), comandos ejecutados desde cada carpeta. **Sin migración ni cambio de esquema** (`backend/database/schema.ts` no cambia), **sin rutas nuevas** (`backend/start/routes.ts` no cambia) y **sin dependencias nuevas**. **No se tocan** (plan.md → Project Structure, contracts/task-list-ui.md): `backend/app/transformers/task_transformer.ts`, `backend/start/routes.ts`, `backend/config/`, los `package.json` de ambos lados, `frontend/src/components/tasks/task-list.tsx`, `task-status-select.tsx`, `empty-tasks-state.tsx`, `task-form.tsx`, `frontend/src/pages/task-page.tsx`, `frontend/src/components/ui/`, ni nada de la zona vallada de `BOUNDARIES.md` (en particular `backend/app/validators/user.ts`, `backend/app/middleware/auth_middleware.ts`, `backend/app/middleware/silent_auth_middleware.ts` y `frontend/src/auth/`).

---

## Phase 1: Setup

**Purpose**: Fijar la línea base antes de tocar nada, para poder demostrar después que no se rompe ni baja nada.

- [ ] T001 [Backend · verificación] Desde `backend/`, correr `npm test` y confirmar que toda la suite está en verde en la rama sin cambios (en particular `list_tasks.spec.ts`, `show_task.spec.ts`, `update_task_status.spec.ts` y `task_overdue.spec.ts`); correr `npm run test:coverage` y anotar el porcentaje de líneas de `backend/app/` que imprime el `text-summary` de c8 como **suelo de referencia** para T021 (nunca por debajo del `COVERAGE_MIN = 60` de `.claude/hooks/guard-tests.mjs`). Anotar el commit de partida (`git rev-parse HEAD`, hoy `754d367`) como base de los diffs de la valla en T020 y T021

**Checkpoint**: Suite en verde, cobertura de partida y commit base anotados.

---

## Phase 2: Foundational (Blocking Prerequisites) — helpers de tests existentes, verde→verde

**Purpose**: Tres ficheros de tests existentes leen `createdAt` de tareas **hechas** en la lista sin filtro, que con FR-001 dejarán de venir; fallarían con un `TypeError`, no por una regresión (research §6, plan → Complexity Tracking). Se cambia **solo el helper** para que busque la fila en las dos vistas (`GET /api/v1/tasks` y `GET /api/v1/tasks?status=done`), **antes** de implementar y en tareas propias. El cambio es neutro: hoy `?status` se ignora y la lista trae todas (verde); después, las dos vistas son una partición de todas las tareas (verde). **Ninguna aserción, título, dataset ni `expectedBody` cambia.**

**⚠️ CRITICAL**: Los tests nuevos de US1 (T006) no se escriben hasta que T005 esté en verde; si no, el rojo de T006 se mezclaría con el de estos helpers.

- [ ] T002 [P] [Backend · tests existentes] En `backend/tests/functional/tasks/show_task.spec.ts`, cambiar **solo** el helper `fetchListed(client, viewer, id)` para que pida `GET /api/v1/tasks` y `GET /api/v1/tasks?status=done` (con `loginAs(viewer)`) y busque la fila por `id` en la concatenación de ambas `data`. `fetchCreatedAt` sigue apoyándose en `fetchListed` sin cambios. No tocar ningún `test(...)`, título, dataset ni `expectedBody` (el caso afectado es «abre una tarea en «Hecho» como cualquier otra») — depende de T001
- [ ] T003 [P] [Backend · tests existentes] En `backend/tests/functional/tasks/update_task_status.spec.ts`, cambiar **solo** el helper `fetchCreatedAt(client, viewer, task)` para que busque la fila de `task.id` en `GET /api/v1/tasks` **y** `GET /api/v1/tasks?status=done`. No tocar ningún `test(...)`, título, dataset (`from: 'done'` ×2), `INVALID_STATUS_ERROR` ni cuerpo esperado (casos afectados: «cambia el estado de {from} a {to}» con `from: 'done'` y «elegir el mismo estado que ya tiene no es un error») — depende de T001
- [ ] T004 [P] [Backend · tests existentes] En `backend/tests/functional/tasks/task_overdue.spec.ts`, cambiar **solo** el helper `fetchListed(client, viewer, id)` igual que en T002 (busca en las dos vistas). No tocar ningún `test(...)` ni aserción (casos afectados: «una tarea hecha con la fecha pasada no está vencida…» y «sacar de «Hecho» una tarea con la fecha pasada vuelve a vencer») — depende de T001
- [ ] T005 [Backend · verificación] Desde `backend/`, `npm test`: toda la suite en verde con los tres helpers nuevos (verde→verde). `git diff 754d367 -- tests/` muestra cambios **solo** dentro de los tres helpers; `list_tasks.spec.ts`, `create_task.spec.ts` y `update_task_due_date.spec.ts` sin diff. Commit opcional con `/commit` (p. ej. `test(tasks): los helpers leen createdAt de las dos vistas de la lista (FS-142)`) — depende de T002, T003, T004

**Checkpoint**: Suite en verde; los helpers ya no dependen de que la lista sin filtro traiga las hechas.

---

## Phase 3: User Story 1 - Acotar la lista por estado (Priority: P1) 🎯 MVP

**Goal**: `GET /api/v1/tasks` sin `status` devuelve todas las pendientes y en curso y ninguna hecha; con `status` = exactamente uno de `pending`/`in_progress`/`done`, todas las de ese estado y ninguna de otro; un estado válido sin coincidencias es `200 { data: [] }`; cualquier otro valor (desconocido, vacío, otra caja, etiqueta en castellano, repetido, «todas») es `422` con la forma VineJS de siempre y sin `data`; sin sesión, `401` antes que el `422`; ninguna lectura modifica ninguna tarea (FR-001 a FR-011).

**Independent Test**: Desde `backend/`, `node ace test --files=list_tasks_by_status` en verde (15 escenarios de la matriz), `node ace test --files=list_tasks` en verde sin editar, `npm test` en verde; y `quickstart.md` §1 con `curl`. Se verifica sin tocar la interfaz.

### Tests for User Story 1 — el contrato en rojo ⚠️

> **Se escriben y se ejecutan en ROJO antes de tocar `models/task.ts`, `validators/task.ts` o `tasks_controller.ts`.** Con la suite en rojo `guard-tests.mjs` bloquea el commit: entre T006 y T011 no se commitea.

- [x] T006 [US1] [Backend · tests nuevos] Crear `backend/tests/functional/tasks/list_tasks_by_status.spec.ts` (con `node ace make:test --suite=functional` o a mano, en `tests/functional/tasks/`) con la matriz **completa** de [contracts/task-list-api.md](./contracts/task-list-api.md#matriz-de-comportamiento-definition-of-done), y ejecutarla en rojo. Reglas del fichero:
  - Grupo `Tasks list by status (GET /api/v1/tasks?status=)`, aislado con `group.each.setup(() => testUtils.db().truncate())`.
  - Fixture común: Oscar y Ana, con tareas de **ambos** en los tres estados, **al menos dos por estado** (para que «todas» no se confunda con «una»); los estados se fijan con `PATCH /api/v1/tasks/:id/status` o directamente en el modelo.
  - Las respuestas `200` se asertan con `assert.deepEqual(response.body(), { data: [...] })` sobre **todas** las filas, **todas** las claves de `TaskTransformer` (`id`, `title`, `status`, `createdAt`, `assignee: { id, fullName, initials }`) y en orden `createdAt` desc, `id` desc, con `createdAt` tomado del detalle `GET /api/v1/tasks/:id` de cada tarea (**no** de la lista que se está probando).
  - Constantes en el propio fichero: `INVALID_STATUS_ERROR = { errors: [{ message: 'The selected status is invalid', rule: 'enum', field: 'status', meta: { choices: ['pending', 'in_progress', 'done'] } }] }` (idéntica a la de `update_task_status.spec.ts`) y `UNAUTHORIZED_ERROR = { errors: [{ message: 'Unauthorized access' }] }`; las `422` y `401` se asertan con `deepEqual` sobre el cuerpo entero.
  - Un `test(...)` por fila, **titulado como su escenario**:
    1. *Sin filtro* — `US1-1 — sin estado: todas las pendientes y en curso, ninguna hecha` → `GET /tasks`: `200`, exactamente las `pending` + `in_progress`, en orden.
    2. *Cada estado* — `US1-2 — «Pendiente»: todas las pendientes, ninguna en curso ni hecha` → `?status=pending`.
    3. *Cada estado* — `US1-3 — «En curso»: todas las que están en curso, ninguna pendiente ni hecha` → `?status=in_progress`.
    4. *Cada estado* — `US1-4 — «Hecho»: todas las hechas, que la lista sin filtro no incluye` → `?status=done` exactamente las `done` **y** ninguna de ellas en `GET /tasks`.
    5. *Sin resultados* — `US1-5 — estado válido sin tareas: lista vacía, no un error` → `?status=in_progress` sin tareas en curso: `200 { data: [] }`.
    6. *Estado no reconocido → 422* — `US1-6 — estado que no es ninguno de los tres ({status}) se rechaza y no devuelve lista`, con dataset `archivada`, `all`, `Pendiente`, `PENDING`, `''` → `422`, cuerpo = `INVALID_STATUS_ERROR`.
    7. *Estado no reconocido → 422* — `US1-7 — el rechazo señala el estado, da los válidos y no se confunde con un filtro sin resultados` → sobre el mismo espacio, `?status=archivada` (`422`, `field: 'status'`, `meta.choices`) frente a `?status=in_progress` vacío (`200 []`): códigos y cuerpos distintos.
    8. *Estado no reconocido → 422* — `US1-8 — mezclar las hechas con el resto se rechaza ({case})`, con dataset `?status=pending&status=done`, `?status=todas`, `?status=pending,done` → `422`, `INVALID_STATUS_ERROR`.
    9. *Cada estado* — `US1-9 — pasar a «Hecho» la saca de la lista sin filtro y la pone en «Hecho»; devolverla la trae de vuelta` → `PATCH …/status` `done` → fuera de `GET /tasks`, dentro de `?status=done`; `PATCH` `pending` → al revés.
    10. *Filtrar no modifica nada* — `US1-10 — pedir la lista, con cualquier filtro, válido o no, no modifica ninguna tarea` → retrasar antes `updated_at` de todas las tareas a un instante fijo; lanzar `GET` sin filtro, con cada estado, `archivada`, `''` y una sin token; comprobar en BD que `status`, `title`, `assigneeId`, `dueDate` y `updated_at` de todas son idénticos.
    11. *Sin resultados* — `US1-11 — una lista vacía permite saber si el espacio no tiene tareas o si ninguna encaja` → espacio vacío: `GET /tasks` = `[]` **y** `?status=done` = `[]`; espacio con solo tareas `done`: `GET /tasks` = `[]` **y** `?status=done` ≠ `[]`.
    12. *401* — `US1-12 — sin sesión no recibe ninguna tarea, con o sin filtro ({case})`, con dataset sin query / `?status=done` / `?status=archivada`, cada uno sin token y con token inválido → `401`, cuerpo = `UNAUTHORIZED_ERROR` (el `401` va antes que el `422`).
    13. *Estado no reconocido → 422* — `Edge — en un espacio sin tareas, un filtro no válido se sigue rechazando` → espacio vacío, `?status=archivada`: `422`, no `200 []`.
    14. `FR-011 — el estado es la única dimensión: cualquier otro parámetro no filtra` → `?assigneeId=<id de Ana>` y `?today=2026-09-29`: `200`, cuerpo idéntico al de `GET /tasks` sin query.
    15. `Assumptions — la lista filtrada mantiene el orden de la lista` → tres `pending` creadas en orden: `?status=pending` en `createdAt` desc, `id` desc.
  - **Ejecutar en rojo**: desde `backend/`, `node ace test --files=list_tasks_by_status` debe **fallar** por la razón correcta (las hechas aparecen sin filtro, `?status=` se ignora, no hay `422`): fallan al menos los escenarios 1-9, 11 (espacio con todo hecho) y 13. Los escenarios 10, 12, 14 y 15 pueden pasar ya en rojo: fijan comportamiento que hoy se cumple y que la implementación no debe romper. El resto de la suite (`npm test` sin este fichero) sigue en verde. Anotar aquí qué falló y por qué — depende de T005
  - **Rojo (2026-09-29)**: `node ace test --files=list_tasks_by_status` → 26 tests (15 escenarios, con los datasets expandidos): **18 fallan, 8 pasan**. Fallan, todos por la razón esperada: 1-4, 9 y 15 porque `?status=` se ignora y las hechas vienen sin filtro (la lista trae las 6 tareas); 5 y 11 porque llegan filas donde se espera `{ data: [] }`; 6 (×5), 7, 8 (×3) y 13 con `expected 200 to equal 422` (no hay validación). Pasan ya: 10, 12 (×6) y 14, que fijan comportamiento actual. El 15 falla (el plan admitía que pasara) porque intercala una tarea `in_progress` entre las tres `pending`, para comprobar el orden dentro de un filtro real. Resto de la suite: 90/90 en verde. `npm run typecheck` y `npm run lint` limpios. **Nota**: T002-T005 (helpers) siguen pendientes; se hizo T006 antes por indicación expresa, y su rojo no se mezcla con el de los helpers porque estos siguen en verde hasta que se implemente FR-001.

### Implementation for User Story 1

- [ ] T007 [P] [US1] [Backend · modelo] En `backend/app/models/task.ts`, junto a `TASK_STATUSES`, añadir la constante de la vista por defecto (research §3, data-model.md): `/** The statuses of the default view of the list: everything that is not done (RF-21). */ export const LIVE_TASK_STATUSES = ['pending', 'in_progress'] as const satisfies readonly TaskStatus[]`. Sin columnas nuevas ni cambios en la clase — depende de T006
- [ ] T008 [P] [US1] [Backend · validador] En `backend/app/validators/task.ts`, añadir `listTasksValidator = vine.create({ status: vine.enum(TASK_STATUSES).optional() })` con un comentario en el estilo de los demás (validador de la query de la lista; `status` opcional, exactamente uno de los tres). **Sin reglas extra**: vacío, desconocido, otra caja y array ya los rechaza el `enum` (research §2, probado con VineJS 4.4). No reutilizar ni tocar `updateTaskStatusValidator` — depende de T006
- [ ] T009 [US1] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, acción `index`: recibir `request`, validar `const { status } = await request.validateUsing(listTasksValidator, { data: request.qs() })` (como hace `show`), y sobre el query existente —mismo `preload('assignee')`, mismo `orderBy('createdAt', 'desc').orderBy('id', 'desc')`— aplicar `status ? query.where('status', status) : query.whereIn('status', LIVE_TASK_STATUSES)`. Misma respuesta `serialize(TaskTransformer.transform(tasks))`; imports por subpath (`#models/task`, `#validators/task`). No tocar `store` ni `show` — depende de T007, T008
- [ ] T010 [US1] [Backend · código generado] Regenerar `backend/.adonisjs/` corriendo `npm test` (o `npm run dev`) desde `backend/` y comprobar con `git diff .adonisjs/` que el único cambio es el registro Tuyau de `tasks.tasks.index` en `.adonisjs/client/registry/`, que gana `query` con `status`. Ese diff se commitea con el cambio; no se edita a mano — depende de T009
- [ ] T011 [US1] [Backend · verificación] Desde `backend/`: `node ace test --files=list_tasks_by_status` en **verde** (los 15 escenarios de T006, sin haber editado ninguno); `node ace test --files=list_tasks` en verde sin editar; `npm test` completo en verde; `npm run typecheck` y `npm run lint` limpios; `git diff 754d367 -- database/schema.ts start/routes.ts app/transformers/` vacío. Con `npm run dev`, recorrer `quickstart.md` §1 con `curl` (vista por defecto, `?status=done`, `?status=in_progress`, `archivada` → 422, `?status=` → 422, repetido → 422, sin token → 401, `?assigneeId=1` igual que sin query). Commit opcional con `/commit` (p. ej. `feat(tasks): filtrar la lista por estado en la API (FS-142)`) — depende de T010

**Checkpoint**: US1 completa y en verde. La API ya no trae las hechas por defecto y las sirve con `?status=done`. **Ojo**: hasta terminar US2, la interfaz esconde las hechas sin camino de vuelta (research §12): no se entrega US1 sola a usuarios; va en el mismo PR que US2.

---

## Phase 4: User Story 2 - El filtro en la interfaz (Priority: P2)

**Goal**: La lista arranca siempre en la vista por defecto; se filtra por un estado con un grupo de botones (uno a la vez, sustituye al anterior) y se quita el filtro; el filtro sobrevive a abrir y cerrar una tarea pero no a recargar, cerrar sesión ni llegar por un enlace; los vacíos (a) estado sin tareas, (b) espacio sin tareas y (c) nada vivo, el filtro no válido y el fallo de carga tienen mensajes distintos; los cambios de estado y la creación corrigen la vista en local; todo operable con teclado (FR-012 a FR-022).

**Independent Test**: Desde `frontend/`, `npm run lint` y `npm run build` limpios; y `quickstart.md` §2 (pasos 1-16) y §3 (solo teclado) en el navegador, con backend y frontend en `npm run dev`.

### Implementation for User Story 2

- [ ] T012 [P] [US2] [Frontend · API] En `frontend/src/lib/api.ts` (contracts/task-list-ui.md → `lib/api.ts`): ampliar `listTasks(token: string, status?: TaskStatus): Promise<Task[]>` para pedir `GET /api/v1/tasks` sin `status` o `GET /api/v1/tasks?status=${encodeURIComponent(status)}` con él; y añadir `spaceHasTasks(token: string, emptyView: TaskStatus | null): Promise<boolean>`, que solo hace las peticiones complementarias necesarias según research §5 (vista por defecto vacía → `?status=done`; `done` vacía → sin filtro; `pending`/`in_progress` vacía → sin filtro y, si está vacía, `?status=done`). Errores como `ApiError` de `toApiError`, sin cambios; **no** añadir nada a `FIELD_LABELS` ni a `translate` (ya cubren `status` y `enum`). `TaskStatus` de `@/lib/types` — depende de T011
- [ ] T013 [P] [US2] [Frontend · rutas] Crear `frontend/src/routes/tasks-layout.tsx`: `export function TasksLayout()` con `const [filter, setFilter] = useState<TaskStatus | null>(null)` y `<Outlet context={{ filter, setFilter }} />`, sin marcado propio; y en el mismo fichero `export function useTaskFilter()` sobre `useOutletContext<{ filter: TaskStatus | null; setFilter: (value: TaskStatus | null) => void }>()`. El filtro **nunca** se lee de ni se escribe en la URL, `history.state`, `localStorage` ni `sessionStorage` (research §7). Si oxlint (`react/only-export-components`) se queja de exportar el hook junto al componente, mover el hook a `frontend/src/routes/use-task-filter.ts`, como ya permite el contrato — depende de T011
- [ ] T014 [US2] [Frontend · rutas] En `frontend/src/routes/app-routes.tsx`, dentro de `<Route element={<ProtectedRoute />}>`, envolver **solo** `/tasks` y `/tasks/:id` en `<Route element={<TasksLayout />}>`; `/profile` queda fuera del layout (ir a Perfil y volver es otra visita → vista por defecto). No tocar `protected-route.tsx` ni `public-only-route.tsx` — depende de T013
- [ ] T015 [P] [US2] [Frontend · componente] Crear `frontend/src/components/tasks/task-status-filter.tsx` con `TaskStatusFilter({ value, onChange }: { value: TaskStatus | null; onChange: (value: TaskStatus | null) => void })` (research §8, contracts/task-list-ui.md): `<div role="group" aria-label="Filtrar por estado">` con un `Button` de `@/components/ui/button` por estado en el orden de `STATUS_LABELS` (`@/lib/task-status`), `size="sm"`, el aplicado `variant="default"` + `aria-pressed="true"` y el resto `variant="outline"` + `aria-pressed="false"`; pulsar el aplicado no hace nada, pulsar otro llama a `onChange(estado)`; «Quitar filtro» `Button variant="ghost" size="sm"` solo si `value !== null`, llama a `onChange(null)`; nunca `disabled`. Debajo, `<p aria-live="polite" className="text-muted-foreground text-sm">` con, sin filtro, «Mostrando pendientes y en curso. Las tareas hechas no se muestran: filtra por «Hecho» para consultarlas.» y, con filtro, «Filtrando por «{STATUS_LABELS[value]}»: solo se muestran las tareas en ese estado.». Sin componentes shadcn nuevos (ni `ToggleGroup`) — depende de T011
- [ ] T016 [US2] [Frontend · página: carga y estados] En `frontend/src/pages/tasks-page.tsx`: leer `{ filter, setFilter }` de `useTaskFilter()`; orden en pantalla título → `TaskForm` → `TaskStatusFilter` → zona de la lista. Carga en un `useEffect` con dependencias `[token, filter, attempt]`: `listTasks(token, filter ?? undefined)` y, si llega vacía, `spaceHasTasks(token, filter)`; limpieza con `ignore = true` para pintar solo la respuesta del último filtro; **con `catch`** (hoy un fallo se pinta como espacio vacío, research §11). Estado con clave = filtro (`'default'` sin filtro) según el `ListState` de data-model.md (`loaded` con `tasks` y `spaceHasTasks` / `invalid-filter` / `error`); mientras la clave no coincide con el filtro actual, la zona de la lista no pinta nada (cargando). Zona de la lista, mutuamente excluyente (research §10, contracts/task-list-ui.md):
  - lista (`tasks.length > 0`) → `<TaskList … />` sin cambios;
  - (a) filtro, `[]`, `spaceHasTasks` → `Card` + `CardHeader`: `CardTitle` «No hay tareas en este estado» · `CardDescription` «Ahora mismo ninguna tarea del equipo está en «{estado}». Elige otro estado o quita el filtro para volver a la vista por defecto.»;
  - (b) `[]`, `!spaceHasTasks`, con o sin filtro → `<EmptyTasksState />` sin cambios;
  - (c) sin filtro, `[]`, `spaceHasTasks` → `Card`: «No hay nada pendiente ni en curso» · «Todas las tareas del equipo están hechas. Para consultarlas, filtra por [Hecho].», donde «Hecho» es un `<button type="button">` con las clases del botón de `EmptyTasksState` que hace `setFilter('done')`;
  - filtro no válido (`ApiError` `422` con `fieldErrors.status`) → `Alert variant="destructive"`: `AlertTitle` «Ese filtro no es válido» · `AlertDescription` con el mensaje de la API + `Button variant="outline" size="sm"` «Volver a la vista por defecto» → `setFilter(null)`;
  - fallo de carga (cualquier otro error) → `Alert variant="destructive"`: «No se ha podido cargar la lista» · mensaje de `ApiError` · «Reintentar» (`attempt + 1`), salvo `401`, como en `TaskPage`.
  El efecto existente de `focusTaskId` (volver desde una tarea) se mantiene — depende de T012, T014, T015
- [ ] T017 [US2] [Frontend · página: cambios locales] En `frontend/src/pages/tasks-page.tsx` (research §9, contracts/task-list-ui.md → Cambios locales): `handleUpdated(task)` (llamado por `TaskStatusSelect` solo con estados confirmados): si `task.status` encaja en la vista (sin filtro: `pending`/`in_progress`; con filtro: `=== filter`) sustituye la fila o la **inserta en su sitio** (`createdAt` desc, `id` desc) si ya no estaba; si no encaja, la quita; en ambos casos `spaceHasTasks = true`. `handleCreated(task)`: sin filtro o con `filter === 'pending'` se antepone; con `in_progress` o `done` → `setFilter(null)` (FR-020); `spaceHasTasks = true`. Sin volver a pedir la lista tras cada cambio; `TaskStatusSelect` y `TaskList` no cambian de contrato — depende de T016
- [ ] T018 [US2] [Frontend · página: foco] En `frontend/src/pages/tasks-page.tsx`: cuando `handleUpdated` quita una fila que contenía `document.activeElement`, mover el foco al enlace de la fila siguiente, o al de la anterior si era la última, o al `CardTitle` del vacío resultante (con `tabIndex={-1}`) si no queda ninguna, para que quien usa teclado no caiga al `<body>` (FR-021). Sin tocar `task-list.tsx`: localizar las filas desde la página (p. ej. por el `id` de la tarea) — depende de T017
- [ ] T019 [US2] [Frontend · verificación] Desde `frontend/`, `npm run lint` (oxlint) y `npm run build` (typecheck + build) limpios. Con `npm run dev` en `backend/` y `frontend/`, recorrer `quickstart.md` §2 (pasos 1-16; el filtro no válido por override en DevTools es opcional) y §3 (solo teclado: aplicar, cambiar y quitar en una pulsación cada uno; foco tras pasar una fila a «Hecho»). Anotar aquí qué pasos se verificaron y cuáles quedan para la revisión humana — depende de T018

**Checkpoint**: US1 y US2 completas. La interfaz filtra, distingue los cinco estados de la lista, no recuerda el filtro entre visitas y lo conserva al abrir y cerrar una tarea.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Comprobaciones globales, la valla y la revisión, antes de pedir revisión humana.

- [ ] T020 [P] [Backend · verificación] Desde `backend/`, `quickstart.md` §0: `node ace migration:run` sin nada pendiente; `git diff 754d367 -- database/schema.ts start/routes.ts app/transformers/ config/` vacío; `node ace list:routes` con `GET /api/v1/tasks` bajo `auth` e idéntico al de partida; `npm run lint` y `npm run typecheck` limpios; `git status .adonisjs/` sin regeneraciones pendientes fuera de la de T010; `git diff --stat 754d367 -- '*/package.json' '*/package-lock.json'` vacío — depende de T019
- [ ] T021 [Cross-cutting · valla + verificación + revisión] Tarea de cierre, en este orden y **antes de pedir revisión humana**:
  1. **Valla intacta**: `git diff 754d367 -- backend/app/validators/user.ts backend/app/middleware/auth_middleware.ts backend/app/middleware/silent_auth_middleware.ts frontend/src/auth/` **vacío**; y vacío también sobre el resto de `BOUNDARIES.md` (`backend/app/controllers/new_account_controller.ts`, `access_tokens_controller.ts`, `profile_controller.ts`, `backend/app/models/user.ts`, las migraciones de `users` y `access_tokens`). Si algo de esto aparece en el diff, se revierte; no se justifica.
  2. **Suite**: desde `backend/`, `npm test` en verde (toda la suite previa + `list_tasks_by_status.spec.ts`; `list_tasks.spec.ts` sin editar; solo los helpers de T002-T004 cambiados en los tests existentes).
  3. **Cobertura**: desde `backend/`, `npm run test:coverage`; el porcentaje de líneas de `backend/app/` no baja del suelo anotado en T001 (y nunca del `COVERAGE_MIN = 60` de `guard-tests.mjs`).
  4. **Formato**: desde `frontend/`, `npm run format`; si cambia algún fichero, comprobar que solo es formato y dejarlo en el diff; repetir `npm run lint` y `npm run build`.
  5. **Commit y PR**: `/commit` y `gh pr create` con la descripción completa de los cambios en el cuerpo (CLAUDE.md → Reglas de proceso), incluyendo el cambio deliberado de contenido de `GET /api/v1/tasks` sin query y los tres helpers (plan → Complexity Tracking).
  6. **Revisión adversarial**: lanzar el subagente `adversarial-reviewer` sobre el diff completo del PR (`gh pr diff` / `git diff 754d367`) contra `specs/005-filtrar-por-estado/spec.md`, `plan.md`, `BOUNDARIES.md` y la constitución. Cada hallazgo bloqueante se corrige, se repiten los pasos 1-4 y se sube al PR; los no bloqueantes que no se corrijan se anotan aquí con su motivo.
  7. Solo entonces: pedir revisión humana.

  — depende de T020

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001. **Bloquea US1**: los helpers deben estar en verde antes de que exista el rojo de T006.
- **US1 (Phase 3)**: depende de T005. Es el MVP de la API, pero **no se entrega sola** (research §12): va en el mismo PR que US2.
- **US2 (Phase 4)**: depende de US1 en verde (T011): la interfaz consume `?status=` y la partición de la vista por defecto.
- **Polish (Phase 5)**: depende de las dos historias.

### Orden de capas dentro del backend

línea base (T001) → helpers de tests existentes (T002 ∥ T003 ∥ T004) → verde→verde (T005) → **matriz nueva en rojo (T006)** → modelo `LIVE_TASK_STATUSES` (T007) ∥ `listTasksValidator` (T008) → `TasksController.index` (T009) → `.adonisjs/` regenerado (T010) → verde (T011).

### Orden de capas dentro del frontend

`lib/api.ts` (T012) ∥ `routes/tasks-layout.tsx` (T013) ∥ `components/tasks/task-status-filter.tsx` (T015) → `routes/app-routes.tsx` (T014, tras T013) → `pages/tasks-page.tsx`: carga y estados (T016) → cambios locales (T017) → foco (T018) → verificación (T019). El endpoint va siempre antes que la interfaz que lo usa: T012 depende de T011.

### Within Each User Story

- Tests escritos y ejecutados en **rojo** antes de la implementación (T006 antes de T007-T009); ningún test de T006 se edita para pasar a verde.
- Modelo y validador antes que controlador; controlador antes que código generado.
- Backend en verde antes de empezar el frontend.
- T016-T018 tocan el mismo fichero (`tasks-page.tsx`): secuenciales.

### Parallel Opportunities

- T002, T003 y T004 (tres ficheros de tests distintos).
- T007 (`models/task.ts`) y T008 (`validators/task.ts`).
- T012 (`lib/api.ts`), T013 (`routes/tasks-layout.tsx`) y T015 (`components/tasks/task-status-filter.tsx`).
- T020 puede adelantarse en paralelo con T019 si el backend no vuelve a cambiar.

---

## Parallel Example: User Story 1

```bash
# Foundational: los tres helpers a la vez
Task: "T002 Helper fetchListed en backend/tests/functional/tasks/show_task.spec.ts"
Task: "T003 Helper fetchCreatedAt en backend/tests/functional/tasks/update_task_status.spec.ts"
Task: "T004 Helper fetchListed en backend/tests/functional/tasks/task_overdue.spec.ts"

# Tras el rojo de T006, dominio y validación a la vez:
Task: "T007 LIVE_TASK_STATUSES en backend/app/models/task.ts"
Task: "T008 listTasksValidator en backend/app/validators/task.ts"
```

## Parallel Example: User Story 2

```bash
# Tras T011, tres ficheros nuevos o independientes a la vez:
Task: "T012 listTasks(token, status?) + spaceHasTasks en frontend/src/lib/api.ts"
Task: "T013 TasksLayout + useTaskFilter en frontend/src/routes/tasks-layout.tsx"
Task: "T015 TaskStatusFilter en frontend/src/components/tasks/task-status-filter.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (línea base) y Phase 2 (helpers verde→verde).
2. T006: la matriz de US1 en **rojo** — el contrato ejecutable.
3. T007-T011: la API en verde. **Validar** con `node ace test --files=list_tasks_by_status` y `quickstart.md` §1.
4. No entregar aquí: sin US2 la interfaz escondería lo hecho sin forma de consultarlo (research §12).

### Incremental Delivery

1. Setup + Foundational → suite en verde con helpers neutros.
2. US1 → API filtrada y en verde (commit opcional en el checkpoint; nunca con la suite en rojo).
3. US2 → interfaz con el filtro, los vacíos y los cambios locales; verificación manual.
4. Polish → valla, suite, cobertura, formato, PR, `adversarial-reviewer`, revisión humana. Un solo PR (FS-142).

---

## Notes

- [P] = archivo distinto, sin dependencias pendientes.
- Entre T006 y T011 la suite está en rojo: no se commitea (`guard-tests.mjs` lo bloquea).
- Ningún test se edita para que pase: los de T006 se escriben una vez, y en los existentes solo cambian los helpers de T002-T004, antes de implementar.
- Si una tarea descubre que el plan no se sostiene (p. ej. un comportamiento de VineJS distinto del de research §2), se para y se anota; no se rediseña en la tarea.
