---

description: "Task list for Cambiar el estado de una tarea desde la lista"
---

# Tasks: Cambiar el estado de una tarea desde la lista

**Input**: Design documents from `/specs/002-cambiar-estado/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/task-status-api.md](./contracts/task-status-api.md), [contracts/task-status-ui.md](./contracts/task-status-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. La historia P1 (US1) lleva la **matriz de comportamiento completa** del endpoint (camino feliz, `422`, `401`, `404`) en `backend/tests/functional/tasks/update_task_status.spec.ts`, escrita y ejecutada en **rojo** antes de tocar ruta, validador, handler y controlador (Principio II de la constitución v1.1.0). US2 es comportamiento de frontend, que no tiene runner de tests (fuera de alcance): se verifica a mano con `quickstart.md`.

**Organization**: Tareas agrupadas por historia de usuario (US1/US2 de `spec.md`), en orden de dependencias. Cada tarea nombra la capa y el archivo que toca. Ninguna tarea rediseña lo que `plan.md`/`research.md`/`contracts/` ya decidieron: solo lo ejecuta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React), comandos ejecutados desde cada carpeta (ver `plan.md` → Project Structure). **Sin migración**: `database/schema.ts`, `app/models/task.ts`, `app/transformers/task_transformer.ts` y `frontend/src/lib/types.ts` no cambian (`data-model.md`).

---

## Phase 1: Setup

**Purpose**: Fijar la línea base antes de tocar nada, para poder demostrar después que no se rompe ni baja nada.

- [X] T001 [Backend · verificación] Desde `backend/`, correr `npm test` y confirmar que `create_task.spec.ts` y `list_tasks.spec.ts` están en verde en la rama sin cambios; correr `npm run test:coverage` y anotar el porcentaje de líneas de `backend/app/` que imprime el `text-summary` de c8 (config en `backend/.c8rc.json`) como **suelo de referencia** para T023

**Checkpoint**: Suite en verde y cobertura de partida anotada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ninguna. El modelo, el transformer, el grupo de rutas `tasks` protegido por `middleware.auth()`, los tipos del frontend y la lista ya existen (E2-1, `specs/001-crear-tarea/`). No hay esquema que cambiar ni carpetas que crear.

**Checkpoint**: US1 puede empezar directamente.

---

## Phase 3: User Story 1 - Cambiar el estado de una tarea desde la lista (Priority: P1) 🎯 MVP

**Goal**: Cualquier miembro con sesión iniciada cambia el estado de cualquier tarea (propia o ajena) desde su fila, entre `pending` / `in_progress` / `done` en cualquier sentido, sin abrirla, sin diálogo y sin campos; un estado fuera del catálogo se rechaza, una tarea inexistente se avisa, y sin sesión no se aplica nada (FR-001 a FR-010).

**Independent Test**: `npm test` en `backend/` con `update_task_status.spec.ts` en verde (matriz filas 1-15 de `contracts/task-status-api.md`); y en la app, cambiar el estado de una tarea propia y de una ajena desde su fila, incluida una vuelta atrás desde «Hecho», y recargar: sigue en el estado elegido (`quickstart.md` §1).

### Tests for User Story 1 (matriz = Definition of Done) ⚠️

> Escribir **todo** el fichero PRIMERO (T002-T007) y comprobar en T008 que falla en rojo antes de implementar T009-T013. Todas las aserciones de cuerpo son `assert.deepEqual(response.body(), …)` sobre el cuerpo **entero** (research.md §9); nada de `assertBodyContains`. `create_task.spec.ts` y `list_tasks.spec.ts` no se editan.

- [X] T002 [US1] [Backend · test] Crear `backend/tests/functional/tasks/update_task_status.spec.ts` con `test.group('Tasks status update (PATCH /api/v1/tasks/:id/status)')`, `group.each.setup(() => testUtils.db().truncate())` y los helpers locales del fichero: crear usuarios (`User.create`, «Oscar Torres» y «Ana …»), crear una tarea en un estado dado (`Task.create({ title, status, assigneeId })`), construir el cuerpo esperado `{ data: { id, title, status, assignee: { id, fullName, initials }, createdAt } }` tomando `createdAt` de la propia API (`GET /api/v1/tasks` antes del cambio), no serializado a mano, y releer la tarea de BD (`Task.findOrFail` + `status`, `title`, `assigneeId`) para las comprobaciones de «BD intacta»
- [X] T003 [US1] [Backend · test] En `backend/tests/functional/tasks/update_task_status.spec.ts`, matriz filas **1-6** (camino feliz) con dataset de Japa `test(...).with([...])` para las 6 transiciones `pending→in_progress`, `pending→done`, `in_progress→pending`, `in_progress→done`, `done→pending`, `done→in_progress`: `PATCH /api/v1/tasks/:id/status` con `.loginAs(oscar)` y `{ status: to }` → `200`, cuerpo completo con `status: to`, y en BD `status` = `to` con `title` y `assigneeId` sin cambios — depende de T002
- [X] T004 [US1] [Backend · test] En el mismo fichero, filas **7-9**: (7) tarea en `done` + `{ status: 'done' }` → `200` cuerpo completo con `status: 'done'`; (8) tarea asignada a Ana, pide Oscar, `{ status: 'done' }` → `200` cuerpo completo con `assignee` = Ana y en BD `assigneeId` sigue siendo Ana (FR-003); (9) tarea «Original» de Oscar + `{ status: 'done', title: 'Hackeado', assigneeId: <id de Ana> }` → `200` cuerpo completo con `title: 'Original'` y `assignee` = Oscar, BD igual (FR-004) — depende de T003
- [X] T005 [US1] [Backend · test] En el mismo fichero, filas **10-11** (`422`), cada una comprobando además «BD intacta» sobre una tarea en `pending`: (10) dataset `{ status: 'archived' }`, `{ status: 'Hecho' }`, `{ status: 'DONE' }` → `422` con cuerpo exacto `{ errors: [{ message: 'The selected status is invalid', rule: 'enum', field: 'status', meta: { choices: ['pending', 'in_progress', 'done'] } }] }`; (11) dataset `{}` y `{ status: '' }` → `422` con cuerpo exacto `{ errors: [{ message: 'The status field must be defined', rule: 'required', field: 'status' }] }` — depende de T004
- [X] T006 [US1] [Backend · test] En el mismo fichero, fila **12** (`401`): tarea en `pending`, `PATCH` **sin** `loginAs` con `{ status: 'done' }` → `401` con cuerpo exacto `{ errors: [{ message: 'Unauthorized access' }] }` y BD intacta — depende de T005
- [X] T007 [US1] [Backend · test] En el mismo fichero, filas **13-15** (`404`), todas con `.loginAs(oscar)` y `{ status: 'done' }` y cuerpo exacto `{ errors: [{ message: 'Row not found' }] }`: (13) `PATCH /api/v1/tasks/999999/status` con BD sin esa tarea; (14) crear una tarea, `task.delete()`, pedir su id → `404` y `Task.query()` sigue devolviendo 0 filas; (15) `PATCH /api/v1/tasks/abc/status` — depende de T006
- [X] T008 [US1] [Backend · verificación] Desde `backend/`, `node ace test functional --files=update_task_status` y confirmar que **falla en rojo** por la razón correcta (la ruta aún no existe, así que todas las filas, incluida la `401`, reciben el `404` de ruta inexistente en lugar del cuerpo esperado; un fallo por error de sintaxis o de import no cuenta como rojo válido), y que `create_task` y `list_tasks` siguen en verde — depende de T007

### Implementation for User Story 1

- [X] T009 [P] [US1] [Backend · validador] Añadir en `backend/app/validators/task.ts`, junto a `createTaskValidator`, `export const updateTaskStatusValidator = vine.create({ status: vine.enum(TASK_STATUSES) })`, importando `TASK_STATUSES` de `#models/task` (única fuente de los tres valores, sin repetir literales; solo declara `status`, así que cualquier otra clave del cuerpo no se persiste — research.md §2) — depende de T008
- [X] T010 [P] [US1] [Backend · excepciones] En `backend/app/exceptions/handler.ts`, dentro de `handle()`, interceptar `error instanceof lucidErrors.E_ROW_NOT_FOUND` (`import { errors as lucidErrors } from '@adonisjs/lucid'`) y responder `ctx.response.status(404).send({ errors: [{ message: 'Row not found' }] })`; el resto de errores sigue en `super.handle(error, ctx)`. No mapear `E_ROUTE_NOT_FOUND` ni ningún otro error (research.md §3) — depende de T008
- [X] T011 [US1] [Backend · controlador] Crear `backend/app/controllers/task_statuses_controller.ts` con `TaskStatusesController.update({ params, request, serialize }: HttpContext)`: **primero** `request.validateUsing(updateTaskStatusValidator)`, **después** `Task.findOrFail(params.id)`, `task.merge({ status }).save()`, `await task.load('assignee')` y `return serialize(TaskTransformer.transform(task))` con `200`; solo asigna `status`, sin rama especial para «mismo estado» ni control de versión (research.md §5) — depende de T009, T010
- [X] T012 [US1] [Backend · rutas] En `backend/start/routes.ts`, dentro del grupo `tasks` existente (el de `.prefix('tasks').as('tasks').use(middleware.auth())`), añadir `router.patch(':id/status', [controllers.TaskStatuses, 'update'])`, **sin** matcher numérico (research.md §4); `GET`/`POST /api/v1/tasks` y el resto de rutas quedan tal cual — depende de T011
- [X] T013 [US1] [Backend · generado] Desde `backend/`, correr `npm test` (o `npm run dev`) para regenerar `backend/.adonisjs/server/controllers.ts` (entrada `TaskStatuses`) y `backend/.adonisjs/client/registry/` (ruta `tasks.task_statuses.update`); no editarlos a mano, y dejar el diff listo para commitear (research.md §10) — depende de T012
- [X] T014 [US1] [Backend · verificación] Desde `backend/`, `node ace test functional --files=update_task_status` → las 15 filas de la matriz en **verde** sin haber editado ni una aserción de T002-T007; `node ace list:routes` muestra `PATCH /api/v1/tasks/:id/status` (`tasks.task_statuses.update`) con middleware `auth`; `npm run typecheck` y `npm run lint` limpios — depende de T013
- [X] T015 [P] [US1] [Frontend · API] En `frontend/src/lib/api.ts`: ampliar `RequestOptions.method` a `'GET' | 'POST' | 'PATCH'`; añadir `FIELD_LABELS.status = 'el estado'`; añadir en `translate()` la rama `case 'enum'` con el texto exacto «Ese estado no es válido. Elige Pendiente, En curso o Hecho.» (la rama `required` ya existente produce «Falta rellenar el estado.»); añadir `export function updateTaskStatus(id: number, status: TaskStatus, token: string): Promise<Task>` → `PATCH /api/v1/tasks/${id}/status` con `{ status }`, desenvolviendo `data`, y que ante un `ApiError` con `status === 404` relance con el texto exacto «Esta tarea ya no existe: puede que alguien la haya borrado. Recarga la página para ver la lista al día.» (solo en esta función, no como rama genérica de `toApiError` — research.md §8). Los mensajes de `401`, sin conexión y `5xx` se reutilizan tal cual — puede empezar en paralelo con T009-T014 una vez fijado el contrato, pero se verifica contra el backend de T014
- [X] T016 [US1] [Frontend · componente] Crear `frontend/src/components/tasks/task-status-select.tsx` con props `{ task, token, onUpdated }`: `<select>` **nativo** con tres `<option>` y solo tres, en este orden — `pending` «Pendiente», `in_progress` «En curso», `done` «Hecho» (etiquetas de `STATUS_LABELS`) —, estilizado con las clases base de `frontend/src/components/ui/input.tsx` (`h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs`, `focus-visible:*`, `aria-invalid:border-destructive`, `dark:bg-input/30`) con ancho automático; `aria-label="Estado de «{task.title}»"`; **nunca** `disabled`; al cambiar llama a `updateTaskStatus()` (T015) y con `200` invoca `onUpdated(task)`; con error muestra `error.message` bajo el control con `FieldError` (`text-destructive text-sm`), `aria-invalid="true"` y `aria-describedby` apuntando al mensaje (contracts/task-status-ui.md → El control). No se añade nada a `frontend/src/components/ui/` ni a `package.json` — depende de T015
- [X] T017 [US1] [Frontend · componente] En `frontend/src/components/tasks/task-list.tsx`: cambiar las props a `{ tasks, token, onTaskUpdated }` y pintar en cada fila `<TaskStatusSelect task={task} token={token} onUpdated={onTaskUpdated} />` en lugar de la píldora de estado actual; título y responsable siguen igual; mantener y exportar/reutilizar `STATUS_LABELS` — depende de T016
- [X] T018 [US1] [Frontend · página] En `frontend/src/pages/tasks-page.tsx`: añadir `handleUpdated(task: Task)` que sustituye en el estado `tasks` el elemento con el mismo `id` (sin reordenar, sin recargar con `listTasks`, sin tocar el estado de `TaskForm`), y pasar `token` y `onTaskUpdated={handleUpdated}` a `TaskList` — depende de T017
- [X] T019 [US1] [Frontend · verificación] Desde `frontend/`, `npm run build` (typecheck) y `npm run lint` (oxlint) limpios; validar a mano `quickstart.md` §1: cambiar estado desde la fila en ≤2 interacciones, las 6 transiciones, tarea ajena sin aviso y con el responsable intacto, solo tres opciones en el desplegable, y el estado persiste al recargar — depende de T018, T014

**Checkpoint**: MVP. El endpoint cumple la matriz completa y desde la fila se cambia el estado de cualquier tarea, persistiendo. Aún no garantiza que la fila vuelva al estado real si el cambio falla ni serializa cambios rápidos (eso es US2).

---

## Phase 4: User Story 2 - El nuevo estado se ve al instante en la fila (Priority: P2)

**Goal**: La fila refleja el nuevo estado en el acto, sin recargar; si el cambio no se guarda (`422`, `404`, `401`, red, `5xx`) vuelve al último estado confirmado por el servidor con un mensaje en castellano; varios cambios seguidos acaban en el último elegido; «Hecho» sigue visible; el resto de la lista no se altera (FR-011 a FR-015).

**Independent Test**: Con US1 hecha, `quickstart.md` §2, §3 y §4: la fila cambia sin recargar y «Hecho» sigue en la lista; texto a medio escribir en el formulario y scroll intactos; con tarea borrada, sesión revocada y backend parado, la fila vuelve al estado anterior con el mensaje correspondiente; cambios rápidos con flechas terminan en el último elegido tras recargar; todo con teclado.

> Sin tests automáticos: el frontend no tiene runner (plan.md → Testing). No se instala ninguno (BOUNDARIES.md: sin dependencias nuevas).

### Implementation for User Story 2

- [X] T020 [US2] [Frontend · componente] En `frontend/src/components/tasks/task-status-select.tsx`, reconciliación optimista (research.md §7, contracts/task-status-ui.md → Comportamiento): el valor mostrado pasa en el acto al elegido y desaparece cualquier mensaje de error previo de la fila; con `200` la tarea devuelta sustituye a la de la fila vía `onUpdated`; con **cualquier** `ApiError` el control vuelve a mostrar el último estado **confirmado por el servidor** (el de la prop `task`), nunca el que se intentó poner, y aparece el mensaje (FR-012, SC-005) — depende de T019
- [X] T021 [US2] [Frontend · componente] En `frontend/src/components/tasks/task-status-select.tsx`, serialización por fila: si hay una petición en vuelo en esa fila, un nuevo cambio **no** lanza otra en paralelo; se guarda solo el último valor como pendiente y, al terminar la en curso, se envía si difiere del confirmado. El control sigue sin `disabled` (no perder el foco con teclado, FR-015). Elegir el estado que ya tiene no muestra error — depende de T020
- [X] T022 [US2] [Frontend · verificación] Desde `frontend/`, `npm run build` y `npm run lint` limpios; validar a mano `quickstart.md` §2 (reflejo inmediato, «Hecho» visible, FR-014 con texto a medio escribir y scroll, cambios rápidos, mismo estado), §3 (tarea borrada vía `node ace repl`, sesión revocada en otra pestaña, backend parado, `curl` con `"archived"`: en ningún caso la fila muestra como guardado lo que no se guardó; recargar tras cada caso) y §4 (solo teclado, foco se queda en el control, mismo anillo de foco que el campo de título) — depende de T021

**Checkpoint**: US1 y US2 completas: cambio de estado desde la fila, fiable ante errores y cambios rápidos, operable con teclado.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Valla, suite completa, cobertura, formato y revisión adversarial antes de pedir revisión humana.

- [X] T023 [Cross-cutting · valla + verificación + revisión] Tarea de cierre, en este orden y **antes de pedir revisión humana o abrir el PR**:
  1. **Dejar intactos** `backend/app/validators/user.ts`, los middlewares de autenticación (`backend/app/middleware/auth_middleware.ts`, `backend/app/middleware/silent_auth_middleware.ts`) y `frontend/src/auth/`: `git diff main -- backend/app/validators/user.ts backend/app/middleware/auth_middleware.ts backend/app/middleware/silent_auth_middleware.ts frontend/src/auth/` debe salir **vacío**. Comprobar también que el diff no toca `backend/database/`, `backend/package.json`, `frontend/package.json`, `backend/tests/functional/tasks/create_task.spec.ts` ni `backend/tests/functional/tasks/list_tasks.spec.ts`.
  2. Desde `backend/`: `npm test` → suite completa en verde (`create_task`, `list_tasks`, `update_task_status`).
  3. Desde `backend/`: `npm run test:coverage` → el porcentaje de líneas de `backend/app/` no baja del suelo anotado en T001.
  4. Desde `frontend/`: `npm run format` (Prettier) y confirmar que no deja cambios sin revisar en `frontend/src/`.
  5. Lanzar el subagente `adversarial-reviewer` sobre el diff completo de la rama contra `specs/002-cambiar-estado/spec.md`, `specs/002-cambiar-estado/plan.md`, `specs/002-cambiar-estado/contracts/`, `BOUNDARIES.md` y `.specify/memory/constitution.md`; resolver cada hallazgo confirmado y volver a correr los pasos 1-4 si hubo cambios.

  — depende de T022

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; fija la línea base de suite y cobertura.
- **Foundational (Phase 2)**: vacía; no bloquea nada.
- **User Story 1 (Phase 3)**: depende de T001. Dentro: tests (T002-T007, mismo fichero, secuenciales) → rojo (T008) → validador y handler (T009, T010) → controlador (T011) → ruta (T012) → regeneración (T013) → verde (T014) → `api.ts` (T015) → componente (T016) → lista (T017) → página (T018) → verificación (T019).
- **User Story 2 (Phase 4)**: depende de US1 completa (T019): modifica el mismo `task-status-select.tsx` que crea T016 y necesita el `handleUpdated` de T018.
- **Polish (Phase 5)**: depende de US1 y US2.

### User Story Dependencies

- **US1 (P1)**: independiente; entrega sola el MVP.
- **US2 (P2)**: construye sobre el componente de US1 (spec: «Depende de que exista la User Story 1, pero se puede verificar por separado»).

### Dentro de cada historia

- Matriz escrita entera y en rojo antes de la implementación (T002-T008 antes de T009-T013). No se edita ninguna aserción para que pase.
- Validador y handler antes que el controlador; controlador antes que la ruta; ruta antes que regenerar `.adonisjs/`.
- Backend en verde antes que consumirlo desde `frontend/src/lib/api.ts`; `api.ts` → componente → lista → página.

### Parallel Opportunities

- T009 (`validators/task.ts`) y T010 (`exceptions/handler.ts`), tras T008: archivos distintos, sin dependencia mutua.
- T015 (`frontend/src/lib/api.ts`) puede redactarse en paralelo con T009-T014, porque el contrato (`contracts/task-status-api.md`) ya fija forma y códigos; se valida contra el backend real en T019.
- T002-T007 **no** son paralelizables: comparten `update_task_status.spec.ts`.
- T016-T018 y T020-T021 son secuenciales (cadena de props y mismo fichero).

---

## Parallel Example: User Story 1

```bash
# Tras T008 (matriz en rojo), en paralelo:
Task: "T009 Añadir updateTaskStatusValidator con vine.enum(TASK_STATUSES) en backend/app/validators/task.ts"
Task: "T010 Añadir la rama E_ROW_NOT_FOUND → 404 { errors: [{ message: 'Row not found' }] } en backend/app/exceptions/handler.ts"
Task: "T015 Añadir updateTaskStatus(), 'PATCH', case 'enum' y FIELD_LABELS.status en frontend/src/lib/api.ts"
```

## Parallel Example: User Story 2

```bash
# Sin paralelismo real: T020 y T021 tocan el mismo frontend/src/components/tasks/task-status-select.tsx.
# Mientras se implementa T020-T021, se puede preparar en otra terminal el escenario de quickstart.md §3
# (segunda cuenta, tarea a borrar vía node ace repl) para T022.
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Phase 1: línea base (T001).
2. Phase 3: matriz en rojo → endpoint en verde → control en la fila (T002-T019).
3. **Parar y validar**: `update_task_status.spec.ts` en verde y `quickstart.md` §1 de punta a punta.
4. Valor demostrable: «cambio en qué ando con un gesto, sobre cualquier tarea, y queda guardado».

### Incremental Delivery

1. Setup → base medida.
2. + US1 → demo: cambiar estado desde la fila (MVP).
3. + US2 → demo: la fila nunca miente (errores, cambios rápidos, teclado).
4. Phase 5 → valla intacta, `npm test` + `npm run test:coverage`, `npm run format`, `adversarial-reviewer` → revisión humana.

---

## Notes

- Una historia (E2-4), un PR (Principio V): 1 endpoint, 1 controlador, 1 validador, 1 rama de handler, 1 fichero de tests, 1 función de API, 1 componente nuevo de fila.
- `backend/.adonisjs/` regenerado se commitea en el mismo PR (T013).
- Los textos de los mensajes son exactos (contracts/task-status-ui.md → Mensajes); no se reformulan.
- Fuera de alcance (no se construye): filtrar por estado u ocultar lo hecho (FS-142), fecha de vencimiento, abrir/editar/reasignar/borrar la tarea, lista viva (E3-2).

---

## Implementation Notes (decisiones tomadas durante `/speckit-implement`)

Registro de lo que no quedaba cerrado del todo en spec/plan y cómo se decidió, para la revisión humana.

- **T001 · Suelo de cobertura**: líneas de `backend/app/` = **63.56 %** (171/269), 10 tests en verde. Tras T023: **67.65 %** (205/303), 30 tests en verde (10 existentes + 20 de `update_task_status`).
- **T008 · Rojo válido**: los 18 casos del fichero fallaron por la razón correcta (`expected 404 to equal 200/422/401` por ruta inexistente; las filas 13-15 fallan en el cuerpo, que era el volcado de depuración y no `{ errors: [...] }`). Sin errores de sintaxis ni de import. `create_task` y `list_tasks` en verde.
- **T013 · Regeneración de `.adonisjs/`**: `npm test` solo regenera `server/controllers.ts`. El registro Tuyau (`client/registry/*`) y `server/routes.d.ts` los escribe el hook `init` del assembler, que corre con `npm run dev`. Se arrancó el dev server unos segundos para regenerarlos. Ficheros regenerados: `server/controllers.ts`, `server/routes.d.ts`, `client/registry/{index.ts,schema.d.ts,tree.d.ts}`.
- **T017 · `STATUS_LABELS`**: se **mueve** de `task-list.tsx` a `task-status-select.tsx`, su único consumidor tras quitar la píldora. Exportarlo desde `task-list.tsx` habría creado un import circular (`task-list` ↔ `task-status-select`) y el aviso `react/only-export-components` de oxlint. Solo se declara una vez, sin literales duplicados. Se aparta de la letra de T017 y de `contracts/task-status-ui.md` («Mantiene `STATUS_LABELS`»), pero no de su intención.
- **T019 / T022 · Verificación**: `npm run build` y `npm run lint` (oxlint) limpios. La API de §1 y §3 se comprobó de punta a punta con `curl` contra el dev server real: las 6 transiciones y el mismo estado dan `200`; una tarea ajena conserva a Ana como responsable; `archived` da `422` con `rule: 'enum'`; un id inexistente da `404 { errors: [{ message: 'Row not found' }] }`; sin token da `401`; `GET` posterior muestra el estado persistido; el preflight CORS admite `PATCH`. **Queda para la revisión humana el recorrido en navegador** de `quickstart.md` §1-§4 (≤2 interacciones, reflejo inmediato, scroll y texto del formulario intactos, errores con backend parado o sesión revocada, solo teclado y anillo de foco). No hay runner de frontend ni navegador automatizado en el repo, y no se ha instalado ninguno.
- **T021 · Error con un cambio encolado**: si la petición en vuelo falla y hay un cambio encolado, el encolado **se descarta** y la fila vuelve al último estado confirmado con el mensaje. Fila y BD coinciden (FR-012, SC-005), y no se reintenta a ciegas algo que probablemente fallaría por la misma causa (red, sesión, tarea borrada). `research.md §7` no cubría este caso.
- **T021 · Límite conocido, no se aborda aquí**: si un `PATCH` se aplica en el servidor pero su respuesta se pierde (corte de red), la fila vuelve al estado anterior con el aviso de conexión aunque la BD ya tenga el nuevo. Recargar lo corrige. Es inherente a la reconciliación sin reconsulta. Además, `shown` y `confirmed` se inicializan una sola vez desde `task.status`: cuando E3-2 (lista viva) sustituya tareas desde fuera, habrá que resincronizarlos.
- **T023 · Base del diff de la valla**: no existe rama local `main` y todo el cambio está sin commitear, así que la comprobación se hizo con `git diff HEAD` (HEAD = `77b5705`, punta de la rama). Salida vacía para `validators/user.ts`, `app/middleware/`, `frontend/src/auth/`, controladores de auth, `models/user.ts`, `database/`, `package.json`/`package-lock.json` de ambos lados, `create_task.spec.ts` y `list_tasks.spec.ts`.
- **T023 · `adversarial-reviewer`**: veredicto *APPROVE-WITH-NOTES*, sin brechas de valla ni desajustes con la spec. Hallazgos resueltos:
  - Matriz reforzada sin editar ninguna aserción existente:
    - tarea «Testigo» en el dataset de transiciones, para detectar una escritura masiva;
    - `{ status: null }` en el dataset de la fila 11 (el contrato lo lista);
    - caso nuevo «cuerpo inválido sobre id inexistente → `422`», que fija el orden de evaluación del contrato.
  - `aria-invalid` solo se renderiza con error (`"true"`), como pide el contrato.
  - El resto de hallazgos se documenta arriba (encolado descartado, respuesta perdida, `STATUS_LABELS`).
  - Tras los cambios se repitieron los pasos 1-4 de T023: todo en verde.
