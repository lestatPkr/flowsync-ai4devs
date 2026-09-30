---

description: "Task list for Fecha de vencimiento y tareas vencidas"
---

# Tasks: Fecha de vencimiento y tareas vencidas

**Input**: Design documents from `/specs/004-fecha-vencimiento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/task-due-date-api.md](./contracts/task-due-date-api.md), [contracts/task-detail-api.md](./contracts/task-detail-api.md), [contracts/task-due-date-ui.md](./contracts/task-due-date-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. Cada endpoint lleva su **matriz de comportamiento completa** (Principio II de la constitución v1.1.0): `PUT /api/v1/tasks/:id/due-date` en `update_task_due_date.spec.ts` (US1), `GET /api/v1/tasks/:id` con `today` en `task_overdue.spec.ts` (US2 y US3), y la actualización explícita de `show_task.spec.ts` (US1). Los tests de cada historia se escriben y se ejecutan en **rojo** antes de su implementación. Todas las aserciones de cuerpo son `assert.deepEqual(response.body(), …)` sobre el cuerpo **entero**; nada de `assertBodyContains` ni `containsSubset`. `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` **no se editan**. El frontend no tiene runner de tests (fuera de alcance, sin dependencias nuevas): su lado se verifica a mano con `quickstart.md`.

**Organization**: Tareas agrupadas por historia de usuario (US1/US2/US3 de `spec.md`), en orden de dependencias: migración → modelo (`isOverdueOn`) → validadores → transformer → controlador → ruta → código generado → interfaz. Cada tarea nombra la capa y el archivo que toca. Ninguna tarea rediseña lo que `plan.md`/`research.md`/`data-model.md`/`contracts/` ya decidieron: solo lo ejecuta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React), comandos ejecutados desde cada carpeta (ver `plan.md` → Project Structure). **No se tocan** (research.md §12, contracts/task-due-date-ui.md): `backend/app/transformers/task_transformer.ts`, `backend/app/controllers/task_statuses_controller.ts`, `backend/app/exceptions/handler.ts`, `backend/config/`, los `package.json` de ambos lados, `frontend/src/pages/tasks-page.tsx`, `frontend/src/components/tasks/*`, `frontend/src/routes/`, ni nada de la zona vallada de `BOUNDARIES.md` (en particular `backend/app/validators/user.ts`, `backend/app/middleware/auth_middleware.ts`, `backend/app/middleware/silent_auth_middleware.ts` y `frontend/src/auth/`). `backend/database/schema.ts` cambia **solo** por `node ace migration:run`.

---

## Phase 1: Setup

**Purpose**: Fijar la línea base antes de tocar nada, para poder demostrar después que no se rompe ni baja nada.

- [X] T001 [Backend · verificación] Desde `backend/`, correr `npm test` y confirmar que `create_task.spec.ts`, `list_tasks.spec.ts`, `show_task.spec.ts` y `update_task_status.spec.ts` están en verde en la rama sin cambios; correr `npm run test:coverage` y anotar el porcentaje de líneas de `backend/app/` que imprime el `text-summary` de c8 (config en `backend/.c8rc.json`) como **suelo de referencia** para T044 (nunca por debajo del `COVERAGE_MIN = 60` de `.claude/hooks/guard-tests.mjs`). Anotar el commit de partida (`git rev-parse HEAD`, hoy `98dcd60`) como base de los diffs de la valla en T040, T041 y T044

  - Nota (T001, al implementar): commit base `98dcd6048258b8a28967dc27424c526062eefa1d` (`98dcd60`); `npm test` 41/41 en verde; `npm run test:coverage` → **Lines 69,93 % (228/326)** de `backend/app/`: ese es el suelo para T044.

**Checkpoint**: Suite en verde, cobertura de partida y commit base anotados.

---

## Phase 2: Foundational (Blocking Prerequisites) — el esquema

**Purpose**: La columna `tasks.due_date`, de la que dependen las tres historias. Es **solo esquema**: ninguna ruta la expone todavía, así que la suite existente sigue en verde y no hay comportamiento observable que testear antes (FR-022 se asierta en T030). Va **antes** de los tests de US1 por dos motivos: (a) así los tests en rojo de US1-US3 fallan por la razón correcta (falta la ruta o faltan las claves), no por `no such column: due_date` al preparar datos; (b) `guard-tests.mjs` bloquea cualquier `git commit` con la suite en rojo, así que el único momento en que la migración y el `schema.ts` regenerado pueden commitearse por sí solos es este. Todo lo que tiene comportamiento (modelo, validadores, transformer, controladores, ruta) sigue yendo detrás de su test en rojo.

**⚠️ CRITICAL**: Ninguna historia empieza hasta que T003 esté commiteado.

- [X] T002 [Backend · migración] Desde `backend/`, `node ace make:migration add_due_date_to_tasks` y rellenar `backend/database/migrations/<timestamp>_add_due_date_to_tasks.ts` (data-model.md → Esquema): `up()` → `this.schema.alterTable('tasks', (table) => { table.date('due_date').nullable() })`, **«`date`, NULL permitido, sin default, sin índice»**: nada de `defaultTo` (un default sería sugerir una fecha, CA-1); `down()` → `this.schema.alterTable('tasks', (table) => { table.dropColumn('due_date') })`. No tocar `1790152501403_create_tasks_table.ts` ni las migraciones de `users`/`access_tokens` (zona vallada). Sin backfill: las tareas existentes quedan con `NULL` (FR-022) — depende de T001
- [X] T003 [Backend · generado + commit] Desde `backend/`, ejecutar `node ace migration:run` (crea la columna y **regenera** `backend/database/schema.ts`) y comprobar con `git diff database/schema.ts` que el único cambio es `TaskSchema` + `@column.date() declare dueDate: DateTime | null` (más el import que genere, si hace falta). **No editar `schema.ts` a mano en ningún caso**: si el diff no es ese, se corrige la migración de T002 y se regenera (`node ace migration:rollback && node ace migration:run`). Verificar además que el `down()` funciona: `node ace migration:rollback && node ace migration:run` y el `schema.ts` resultante es idéntico al primero. `npm test` sigue en verde sin tocar ningún test (la columna nullable no cambia nada existente). Commitear **la migración y el `schema.ts` regenerado tal cual salen** con la skill `/commit` (p. ej. `feat(tasks): añade la columna due_date a tasks (FS-118)`) — depende de T002

  - Nota (T002, al implementar): `node ace make:migration add_due_date_to_tasks` en Lucid 22 infiere el nombre `alter_tasks_table`; se renombró el fichero a `1790714323303_add_due_date_to_tasks.ts` (mismo timestamp) para que coincida con data-model.md.
  - Nota (T003, al implementar): `git diff database/schema.ts` = solo `TaskSchema.$columns` + `@column.date() declare dueDate: DateTime | null` (sin import nuevo, `DateTime` ya estaba). Rollback + run deja el `schema.ts` idéntico. `npm test` 41/41 en verde. **No se commitea**: la instrucción de esta ejecución es no hacer commits ni PR (los hace el humano tras la revisión); la migración y el `schema.ts` regenerado quedan en el working tree tal cual salieron.

**Checkpoint**: `tasks.due_date` existe, `TaskSchema` expone `dueDate`, suite en verde, commiteado. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Poner, cambiar y quitar la fecha al abrir la tarea (Priority: P1) 🎯 MVP

**Goal**: Cualquier miembro con sesión pone, cambia o quita la fecha de cualquier tarea (propia o ajena) desde su vista, con guardado automático, sin confirmación y solo con teclado si quiere; una fecha inexistente o mal formada se rechaza junto al campo y la tarea conserva la que tuviera; un fallo de conexión o una tarea borrada no se dan por guardados (FR-001, FR-003 a FR-010, FR-018 a FR-021).

**Independent Test**: `npm test` en `backend/` con `update_task_due_date.spec.ts` (matriz filas 1-24 de `contracts/task-due-date-api.md`) y `show_task.spec.ts` actualizado en verde; y en la app, `quickstart.md` §1 y §2 (poner, recargar, abrir como otra persona, cambiar, quitar sin confirmación, fecha inexistente, sin conexión, tarea borrada) más la parte de poner/cambiar/quitar de §4 (solo teclado).

### Tests for User Story 1 (matriz = Definition of Done) ⚠️

> Escribir **todo** `update_task_due_date.spec.ts` (T004-T010) y la actualización de `show_task.spec.ts` (T011) PRIMERO, y comprobar en T012 que fallan en rojo antes de implementar T013-T020. Todas las peticiones del `PUT` llevan `?today=2026-09-30` salvo que la fila diga otra cosa; ninguna fecha de preparación sale del reloj salvo la fila 18.

- [X] T004 [US1] [Backend · test] Crear `backend/tests/functional/tasks/update_task_due_date.spec.ts` con `test.group('Tasks due date (PUT /api/v1/tasks/:id/due-date)')`, `group.each.setup(() => testUtils.db().truncate())` y helpers **locales** del fichero, mismo estilo que `update_task_status.spec.ts` y `show_task.spec.ts` (sin extraerlos a `tests/`): `const TODAY = '2026-09-30'`; `createOscar()` y `createAna()` (`User.create`); `createTask({ title, status, assigneeId, dueDate? })` (`Task.create`, con `dueDate: DateTime.fromISO('AAAA-MM-DD')` cuando se pasa); `fetchCreatedAt(client, user, id)` que toma `createdAt` de la fila de esa tarea en `GET /api/v1/tasks` (no serializado a mano); `expectedDetail(task, assignee, createdAt, { dueDate, isOverdue })` que construye el cuerpo completo `{ data: { id, title, status, assignee: { id, fullName, initials }, createdAt, dueDate, isOverdue } }`; y `snapshot(id)` que relee con `Task.findOrFail` y devuelve `{ dueDate: task.dueDate?.toISODate() ?? null, status, title, assigneeId, updatedAt }` (`updatedAt` como ISO o millis) para las comprobaciones de «BD» — depende de T003
- [X] T005 [US1] [Backend · test] En `backend/tests/functional/tasks/update_task_due_date.spec.ts`, matriz filas **1-3** (camino feliz), `.loginAs(oscar)`: (1) tarea de Oscar sin fecha en `pending` → `{ dueDate: '2026-10-15' }` → `200`, cuerpo completo con `dueDate: '2026-10-15'`, `isOverdue: false`; BD con esa fecha y `status`/`title`/`assigneeId` intactos; (2) tarea con `2026-10-15` → `{ dueDate: '2026-11-01' }` → `200`, cuerpo completo y BD con `'2026-11-01'`; (3) tarea con `2026-10-15` → `{ dueDate: null }` → `200`, cuerpo completo con `dueDate: null`, `isOverdue: false`; BD `null` — depende de T004
- [X] T006 [US1] [Backend · test] En el mismo fichero, filas **4-6** (la respuesta ya trae la condición recalculada): (4) tarea `pending` sin fecha → `{ dueDate: '2026-09-01' }` → `200`, cuerpo completo con `isOverdue: true` (CA-13, sin aviso ni confirmación); (5) tarea `pending` con `2026-09-01` → `{ dueDate: null }` → `200`, `isOverdue: false` **en esa misma respuesta** (CA-3); (6) tarea `pending` con `2026-09-01` → `{ dueDate: '2026-10-15' }` → `200`, `isOverdue: false` (CA-10) — depende de T005
- [X] T007 [US1] [Backend · test] En el mismo fichero, filas **7-10b**: (7) tarea de Ana, Oscar pone `'2026-10-15'` → `200`, cuerpo completo con `assignee` = Ana, sin campos extra (CA-17); (8) tarea `pending` → `{ dueDate: '2026-10-15', status: 'done', title: 'x', assigneeId: <id de Ana> }` → `200`; BD: `status`, `title` y `assigneeId` sin cambios (FR-020); (9) tarea con `2026-10-15` → `{ dueDate: '2026-10-15' }` → `200`, cuerpo completo; `updatedAt` de `snapshot` antes = después; (10) tarea sin fecha → `'1000-01-01'` y luego `'9999-12-31'` → `200` en ambas, con esa fecha en cuerpo y BD; (10b) tarea con `2026-10-15` → `{ dueDate: '' }` → `200`, `dueDate: null`, BD `null` (`convertEmptyStringsToNull` del bodyparser, que no se toca) — depende de T006
- [X] T008 [US1] [Backend · test] En el mismo fichero, filas **11-17** (`422`), cada una asertando el cuerpo **completo** y que la BD conserva la fecha previa (CA-14): (11) tarea con `2026-10-15` → `'2026-02-31'` → `{ errors: [{ message: 'The dueDate field must be a datetime value', rule: 'date', field: 'dueDate' }] }`; (12) misma preparación, una petición por cada valor `'30/09/2026'`, `'2026-9-30'`, `'2026-09-30T00:00:00Z'`, `'mañana'` → mismo cuerpo `date`; (13) tarea sin fecha → `'2025-02-29'` → `422`, BD sigue `null`; (14) tarea con `2026-10-15` → `{}` → `{ errors: [{ message: 'The dueDate field must be defined', rule: 'required', field: 'dueDate' }] }`; (15) tarea sin fecha → `'0999-12-31'` → regla `date.afterOrEqual`, mensaje `'The dueDate field must be a date after or equal to 1000-01-01'` y el `meta` **exacto** que emite la regla en VineJS 4.4 (leerlo del código de la regla en `backend/node_modules/@vinejs/vine/build/`, no inventarlo), y `'10000-01-01'` → cuerpo `date`; BD sigue `null` en ambas; (16) tarea con `2026-10-15`, `?today=2026-02-31` y cuerpo válido → cuerpo `date` con `field: 'today'` y `message: 'The today field must be a datetime value'`; BD conserva `2026-10-15`; (17) tarea con `2026-10-15`, `?dueDate=2026-11-01` y cuerpo `{}` → `422` `required`; BD conserva `2026-10-15` (la fecha solo sale del cuerpo, research.md §4) — depende de T007
- [X] T009 [US1] [Backend · test] En el mismo fichero, fila **18** (fallback): tarea `pending`, **sin** query `today`, `{ dueDate: DateTime.utc().minus({ days: 2 }).toISODate() }` → `200`, cuerpo completo con `isOverdue: true` (el ±2 días evita depender de la hora a la que corra la suite, research.md §9) — depende de T008
- [X] T010 [US1] [Backend · test] En el mismo fichero, filas **19-24**: (19) tarea con `2026-10-15`, **sin** `loginAs`, cuerpo válido → `401`, `{ errors: [{ message: 'Unauthorized access' }] }`, BD intacta; (20) igual con `.header('Authorization', 'Bearer oat_no-es-un-token')` → `401`, mismo cuerpo, BD intacta; (21) `PUT /api/v1/tasks/999999/due-date` con cuerpo válido → `404`, `{ errors: [{ message: 'Row not found' }] }`; (22) crear una tarea, `task.delete()`, `PUT` sobre su id → `404`, mismo cuerpo; (23) `PUT /api/v1/tasks/abc/due-date` → `404`, mismo cuerpo; (24) `PUT /api/v1/tasks/999999/due-date` con `{ dueDate: 'mañana' }` → `422` (se valida antes de buscar) — depende de T009
- [X] T011 [P] [US1] [Backend · test] Actualizar `backend/tests/functional/tasks/show_task.spec.ts` (research.md §8, contracts/task-detail-api.md → `show_task.spec.ts`): `expectedBody()` añade `dueDate: null` e `isOverdue: false` (las tareas de ese fichero no tienen fecha), y los tests de camino feliz siguen asertando el cuerpo completo; el test «el detalle coincide con la fila de esa tarea en la lista» pasa a `assert.deepEqual(response.body().data, { ...listed, dueDate: null, isOverdue: false })` (las dos claves nuevas son las **únicas** diferencias permitidas). Los tests de `401` y `404` no cambian. Ninguna aserción se debilita ni se borra: es el test de cambio de comportamiento del Principio II, no un test editado para que pase — puede escribirse en paralelo con T004-T010 (archivo distinto); depende de T003
- [X] T012 [US1] [Backend · verificación] Desde `backend/`, `node ace test functional --files=update_task_due_date` y `node ace test functional --files=show_task`, y confirmar que **fallan en rojo por la razón correcta**: el `PUT` aún no existe (los `200`, `401` y `422` reciben el `404` de ruta inexistente, y los `404` fallan en el cuerpo), y en `show_task` los camino feliz fallan porque faltan `dueDate`/`isOverdue` (sus `401` y `404` siguen en verde). Un fallo por error de sintaxis o de import no cuenta como rojo válido. `npm run typecheck` puede quejarse del `PUT` en el `apiClient` tipado hasta que T019 regenere el registro: es esperado y no se arregla tocando el test. `create_task`, `list_tasks` y `update_task_status` siguen en verde — depende de T010, T011

  - Nota (T008, al implementar): el `meta` de `date.afterOrEqual` en VineJS 4.4 (`build/index.js`, `afterOrEqualRule`) es `{ expectedValue: '1000-01-01', compare: 'day' }`; así queda en el test.
  - Nota (T007 fila 9, al implementar): `updated_at` se guarda en SQLite con precisión de segundo, así que una escritura en el mismo segundo que la creación no movería `updatedAt`. Para que la fila 9 cace de verdad una escritura, el test fija antes `updated_at` a `2026-01-01 00:00:00` con un helper local `backdateUpdatedAt(id)` (`db.from('tasks')`, solo preparación) y aserta el `snapshot` completo antes = después.
  - Nota (T012, al implementar): rojo por la razón correcta. `update_task_due_date`: 30/30 fallan — 13 `200`, 12 `422` y 2 `401` reciben el `404` de ruta inexistente, y los 3 `404` fallan en el cuerpo (no es `Row not found`). `show_task`: 6 caminos felices fallan porque faltan `dueDate`/`isOverdue`; los 5 de `401`/`404` en verde. Resto de la suite (30 tests) en verde.

### Implementation for User Story 1 — backend

- [X] T013 [US1] [Backend · modelo] En `backend/app/models/task.ts`, añadir el método de instancia `isOverdueOn(today: DateTime): boolean` (`DateTime` de `luxon`), **único sitio de la regla** (data-model.md → La regla, research.md §2): `true` si y solo si `this.dueDate !== null` **y** `this.status !== 'done'` **y** `this.dueDate.toISODate() < today.toISODate()` (comparación de cadenas `'AAAA-MM-DD'` por día natural, **no** `this.dueDate < today.startOf('day')`, que falla con zonas distintas). **No** redeclarar `dueDate` (lo hereda de `TaskSchema`); `TASK_STATUSES`, `status` y `belongsTo assignee` quedan igual — depende de T012
- [X] T014 [P] [US1] [Backend · validadores] En `backend/app/validators/task.ts` (research.md §4-§5): (a) builder compartido `calendarDay()` = `vine.date({ formats: ['YYYY-MM-DD'] }).afterOrEqual('1000-01-01').transform(...)` que convierte el `Date` de VineJS en `DateTime` de Luxon y **devuelve `null` para `null`** (VineJS llama al `transform` con `null` en campos `.nullable()`); formato único pasado explícito (el default de VineJS aceptaría hora); **«rango `1000-01-01`–`9999-12-31`»**: el inferior con `afterOrEqual`, el superior lo impone el propio formato; (b) `export const updateTaskDueDateValidator = vine.create({ dueDate: calendarDay().nullable() })` (**clave obligatoria**; `null` = quitar); (c) `export const taskReadingDayValidator = vine.create({ today: calendarDay().optional() })`. Usar `vine.create`, no `vine.compile`. `createTaskValidator` y `updateTaskStatusValidator` no cambian (crear sigue aceptando solo `title`, FR-002); `backend/app/validators/user.ts` no se toca — archivo distinto de T013; depende de T012
- [X] T015 [US1] [Backend · transformer] En `backend/app/transformers/task_detail_transformer.ts` (research.md §7): constructor `constructor(resource: Task, protected today: DateTime)` que llama a `super(resource)` (comprobar la firma real en `backend/node_modules/@adonisjs/http-transformers/build/src/base_transformer.d.ts`; `BaseTransformer.transform(data, ...rest)` pasa `rest` al constructor); `toObject()` conserva lo que ya devolvía (`id`, `title`, `status`, `createdAt`, `assignee{ id, fullName, initials }`) y añade `dueDate: this.resource.dueDate?.toISODate() ?? null` (**no** con `this.pick`, que serializaría un instante ISO completo) e `isOverdue: this.resource.isOverdueOn(this.today)`. `backend/app/transformers/task_transformer.ts` no se toca — depende de T013
- [X] T016 [US1] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, acción `show`: pasar el día de referencia al transformer ya ampliado, `serialize(TaskDetailTransformer.transform(task, DateTime.utc()))`. Leer `?today` de la query es de US2 (T033); aquí solo se mantiene la acción compilando y respondiendo con la forma nueva. `index` y `store` quedan igual — depende de T015
- [X] T017 [US1] [Backend · controlador] Crear `backend/app/controllers/task_due_dates_controller.ts` (con `node ace make:controller` o a mano, siguiendo el patrón de `task_statuses_controller.ts`), `export default class TaskDueDatesController` con `async update({ params, request, serialize }: HttpContext)` en este orden (contracts/task-due-date-api.md, research.md §6): `const { dueDate } = await request.validateUsing(updateTaskDueDateValidator, { data: request.body() })` → `const { today } = await request.validateUsing(taskReadingDayValidator, { data: request.qs() })` → `const task = await Task.findOrFail(params.id)` → `await task.merge({ dueDate }).save()` → `await task.load('assignee')` → `return serialize(TaskDetailTransformer.transform(task, today ?? DateTime.utc()))`. Sin `try/catch` (el `404` lo da la rama `E_ROW_NOT_FOUND` existente de `app/exceptions/handler.ts`); solo se escribe `due_date`. Si la fila 9 (misma fecha, `updatedAt` quieto) falla porque Lucid marca como sucio un `DateTime` del mismo día, no hacer `merge`/`save` cuando `task.dueDate?.toISODate() === dueDate?.toISODate()` (la decisión del plan es «la misma fecha no escribe») — depende de T014, T015
- [X] T018 [US1] [Backend · rutas] En `backend/start/routes.ts`, **dentro** del grupo `tasks` existente (el de `.prefix('tasks').as('tasks').use(middleware.auth())`), añadir `router.put(':id/due-date', [controllers.TaskDueDates, 'update'])`, sin matcher. Ninguna ruta existente cambia de path, verbo ni middleware — depende de T017
- [X] T019 [US1] [Backend · generado] Desde `backend/`, arrancar `npm run dev` unos segundos y pararlo (el hook `init` del assembler escribe el registro Tuyau; `npm test` solo regenera `server/controllers.ts`) para regenerar `backend/.adonisjs/server/controllers.ts` (entra `TaskDueDates`), `backend/.adonisjs/client/registry/` (ruta `PUT`), `backend/.adonisjs/server/routes.d.ts` y `backend/.adonisjs/client/data.d.ts` (`TaskDetail` con `dueDate`/`isOverdue`). No editarlos a mano; dejar el diff listo para commitear. Anotar el nombre real de la ruta (previsiblemente `tasks.task_due_dates.update`, research.md §6) — depende de T018
- [X] T020 [US1] [Backend · verificación] Desde `backend/`: `node ace test functional --files=update_task_due_date` y `--files=show_task` en **verde** sin haber tocado ninguna aserción de T004-T011; `npm test` entero en verde (`create_task`, `list_tasks`, `update_task_status` sin editar); `node ace list:routes` muestra `PUT /api/v1/tasks/:id/due-date` con middleware `auth` y el resto de rutas igual; `npm run typecheck` y `npm run lint` limpios — depende de T019

  - Nota (T014, decidido al implementar): research.md §5 daba por hecho que VineJS entrega un `Date` y pedía un `.transform(Date → DateTime)` en `calendarDay()`. No es así en este repo: `backend/start/validator.ts` ya registra `VineDate.transform((value) => DateTime.fromJSDate(value))` como transform **global**, y un `.transform` propio recibía ya un `DateTime` (`value.getFullYear is not a function` → `500`). `calendarDay()` queda en `vine.date({ formats: ['YYYY-MM-DD'] }).afterOrEqual('1000-01-01')`: la salida ya es `DateTime | null` y el `null` no pasa por el transform global (la regla `date` solo muta valores válidos). Mismo contrato, una pieza menos.
  - Nota (T017, al implementar): la fila 9 (misma fecha, `updatedAt` quieto) pasa sin el atajo condicional: Lucid no marca como sucio un `DateTime` del mismo día, así que `merge({ dueDate }).save()` no emite `UPDATE`. No se añadió el `if`.
  - Nota (T019, al implementar): ya había servidores `node ace serve --hmr` corriendo en la máquina (no lanzados por esta sesión, no se han parado); su HMR regeneró `.adonisjs/` al guardar `routes.ts`. Diff: `server/controllers.ts` (+`TaskDueDates`), `server/routes.d.ts`, `client/registry/{index.ts,schema.d.ts,tree.d.ts}` (+ruta `PUT`). `client/data.d.ts` no cambia: `Data.TaskDetail = InferData<TaskDetailTransformer>` se infiere solo. Nombre real de la ruta: **`tasks.task_due_dates.update`**.
  - Nota (T020, al implementar): `update_task_due_date` 30/30 y `show_task` 11/11 en verde; `npm test` 71/71; `list:routes` con `PUT /api/v1/tasks/:id/due-date` bajo `auth`, resto igual. Para que `typecheck` pase, la fila 8 construye el cuerpo con claves de más en una variable antes de `.json(body)` (el `apiClient` tipado rechaza claves extra en un literal); y `lint` pidió sacar `(await snapshot(...)).campo` a una variable. Ningún cambio de aserción.

### Implementation for User Story 1 — frontend

- [X] T021 [P] [US1] [Frontend · tipos] En `frontend/src/lib/types.ts`, añadir `export type TaskDetail = Task & { dueDate: string | null; isOverdue: boolean }` con el comentario de espejo de `TaskDetailTransformer` (contracts/task-due-date-ui.md → `lib/types.ts`). `Task` (la lista) **no cambia** — puede empezar en paralelo con T004-T020 (el contrato ya está fijado); depende de T003
- [X] T022 [US1] [Frontend · API] En `frontend/src/lib/api.ts` (research.md §10, contracts/task-due-date-ui.md → `lib/api.ts`): (a) `RequestOptions.method` admite `'PUT'`; (b) helper interno `localToday()` que devuelve la fecha **local** del navegador en `AAAA-MM-DD` con `getFullYear()`, `getMonth() + 1`, `getDate()` y ceros a la izquierda (**nunca** `toISOString()`), calculado en cada llamada; (c) `getTask(id, token)` pasa a devolver `Promise<TaskDetail>` (el `?today` lo añade US2 en T035); (d) `export function setDueDate(id: number, dueDate: string | null, token: string): Promise<TaskDetail>` → `PUT /api/v1/tasks/${id}/due-date?today=${localToday()}` con cuerpo `{ dueDate }`, desenvolviendo `data`, con el `404` traducido igual que en `getTask` (status `404`, mensaje de tarea inexistente); (e) `FIELD_LABELS.dueDate = 'la fecha de vencimiento'` y `translate()` traduce las reglas `date` y `date.afterOrEqual` a **«Esa fecha no existe o está incompleta. Escribe un día, un mes y un año de cuatro cifras.»**, que llega a `ApiError.fieldErrors.dueDate` por el mecanismo existente — depende de T021
- [X] T023 [US1] [Frontend · página] En `frontend/src/pages/task-page.tsx`, tipar la tarea cargada como `TaskDetail` y añadir la fila «Vence el» al `<dl>` existente, **después** de «Creada el» (contracts/task-due-date-ui.md → `pages/task-page.tsx`): `<dt>` con `<Label htmlFor="due-date">Vence el</Label>`; `<dd>` con `<Input id="due-date" type="date">` **no controlado** (`defaultValue={dueDate ?? ''}` y una `key` que cambia cuando cambia la fecha guardada y tras cada fallo), `aria-invalid` y `aria-describedby="due-date-error"` cuando hay error; con fecha, texto «Vence el 30 de septiembre de 2026» formateado con `new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' })` sobre `` new Date(`${dueDate}T00:00:00Z`) `` (el `timeZone: 'UTC'` es obligatorio); sin fecha, **nada** (ni «Sin fecha» ni aviso, CA-12); `<Button variant="outline" size="sm">Quitar fecha</Button>` solo cuando hay fecha; `<FieldError id="due-date-error">` (componente existente) bajo el campo. Solo componentes de `src/components/ui/` ya generados, sin rediseño. Título, responsable, estado y creación siguen como texto de solo consulta (FR-020) — depende de T022
- [X] T024 [US1] [Frontend · página] En `frontend/src/pages/task-page.tsx`, el guardado automático (research.md §11, contracts/task-due-date-ui.md → Comportamiento del campo): cada `change` con valor completo (`/^\d{4}-\d{2}-\d{2}$/` y año ≥ 1000) programa `setDueDate` tras ~500 ms, y el `blur` adelanta el guardado pendiente; sin botón de guardar ni confirmación (CA-15, CA-16); nunca dos peticiones solapadas: si hay una en curso, se guarda el último valor pendiente cuando termine y **solo** se pinta la respuesta de la última; `validity.badInput` (día imposible o a medio escribir) → mensaje de fecha inválida junto al campo, **sin** petición; vacío sin `badInput` (segmentos borrados) → no se envía nada y al perder el foco el campo vuelve a la fecha guardada; «Quitar fecha» (clic, `Enter` o `Espacio`) → `setDueDate(id, null, token)` al momento y, tras la respuesta, el foco vuelve al campo. Con `200`, la tarea mostrada se reemplaza por la de la respuesta, sin recargar (FR-006) — depende de T023
- [X] T025 [US1] [Frontend · página] En `frontend/src/pages/task-page.tsx`, las respuestas de error del guardado (contracts/task-due-date-ui.md → Respuestas del guardado): `422` → `fieldErrors.dueDate` junto al campo y el campo vuelve a la fecha guardada (CA-14); sin conexión (`status: 0`) o `5xx` → «No se ha podido guardar la fecha. Comprueba la conexión e inténtalo de nuevo.» junto al campo, el campo vuelve a la fecha guardada y no se da el cambio por hecho (FR-009); `401` → el mensaje de sesión caducada que ya da `toApiError`, junto al campo, sin tocar `frontend/src/auth/`; `404` → la página pasa al estado «Esta tarea ya no existe» que ya tiene, con «Volver a la lista» (FR-010); un `200` posterior borra cualquier error del campo — depende de T024
- [X] T026 [US1] [Frontend · verificación] Desde `frontend/`, `npm run build` y `npm run lint` limpios; con el backend de T020, validar a mano `quickstart.md` §1 (poner, reflejo inmediato, recargar, abrir como otra persona, cambiar, quitar sin confirmación, tarea ajena, fecha pasada aceptada) y §2 (día inexistente, fecha a medio escribir, sin conexión, tarea borrada, sesión caducada), y la parte de poner/cambiar/quitar solo con teclado de §4 — depende de T020, T025

  - Nota (T022, al implementar): el mapeo del `404` de `getTask` se extrajo a un helper interno `taskNotFound()` que comparten `getTask` y `setDueDate` (mismo mensaje «Puede que alguien la haya borrado.», que es el que pinta el estado «Esta tarea ya no existe»). El texto de fecha inválida se exporta como `INVALID_DATE_MESSAGE` porque la vista lo usa también para el aviso local de `badInput`, sin petición.
  - Nota (T023-T024, decidido al implementar): la fila vive en un componente `DueDateRow` dentro del mismo `task-page.tsx` (no en `components/tasks/`, que no se toca). La `key` del campo es un contador que se incrementa (a) tras cada fallo y (b) tras un `200` **solo si** el valor que muestra el campo no coincide ya con la fecha guardada (p. ej. «Quitar fecha»). Así, guardar lo que se acaba de teclear no vuelve a montar el input ni le quita el foco; el efecto es el del contrato (el campo siempre acaba mostrando la fecha guardada). Al volver a montarlo se conserva el foco si lo tenía, y tras «Quitar fecha» se lleva al campo.
  - Nota (T026, al implementar): hecho `npm run build` y `npm run lint` limpios, y una prueba de humo con `curl` contra el dev server (`PUT …/due-date?today=2026-09-30` → `200` con `dueDate`/`isOverdue`; `OPTIONS` con CORS que admite `PUT`). **La validación manual en navegador de `quickstart.md` §1, §2 y §4 queda pendiente para la revisión humana**: esta ejecución no maneja un navegador.

**Checkpoint**: US1 completa y verificable por sí sola: la fecha se pone, cambia y quita desde la vista, con la matriz del `PUT` y el `show_task` actualizado en verde.

---

## Phase 4: User Story 2 - Saber si una tarea está vencida (Priority: P2)

**Goal**: Al abrir una tarea, la vista dice «Vencida» si y solo si tiene fecha anterior al día de hoy **de quien mira** y no está en «Hecho»; decidido al mirar, no al guardar, de modo que vence sola al pasar la medianoche y dos husos pueden leerla distinto, ambos correctamente (FR-011 a FR-016).

**Independent Test**: `npm test` en `backend/` con las filas 1-11, 14-17 y 20 de `task_overdue.spec.ts` (`contracts/task-detail-api.md` → Matriz) en verde; y en la app, `quickstart.md` §3 (los cuatro bordes, «Hecho» y vuelta, aplazar, quitar, dos husos, medianoche) y la parte de la señal de §4 (se lee como texto, se anuncia).

### Tests for User Story 2 (matriz = Definition of Done) ⚠️

> Escribir T027-T031 PRIMERO y comprobar en T032 que el fichero falla en rojo antes de T033. Los días de referencia se fijan con `?today=` explícito, **nunca** con el reloj, salvo las filas 14-15 del fallback.

- [X] T027 [US2] [Backend · test] Crear `backend/tests/functional/tasks/task_overdue.spec.ts` con `test.group('Tasks overdue (GET /api/v1/tasks/:id?today=)')`, `group.each.setup(() => testUtils.db().truncate())` y helpers **locales** del fichero con el mismo estilo que T004 (`createOscar`, `createAna`, `createTask({ title, status, assigneeId, dueDate? })` con `DateTime.fromISO`, `fetchCreatedAt`, `expectedDetail(task, assignee, createdAt, { dueDate, isOverdue })`, `snapshot(id)`), sin importarlos de `update_task_due_date.spec.ts` — depende de T020
- [X] T028 [US2] [Backend · test] En `backend/tests/functional/tasks/task_overdue.spec.ts`, los **cuatro bordes de la regla**, todos con `GET /api/v1/tasks/:id?today=2026-09-30` y cuerpo completo: (1) **día anterior**: `pending`, `dueDate 2026-09-29` → `dueDate: '2026-09-29'`, `isOverdue: true` (CA-4); (2) **mismo día**: `pending`, `2026-09-30` → `isOverdue: false` (CA-5); (3) **día posterior**: `pending`, `2026-10-01` → `isOverdue: false` (CA-6); (4) **sin fecha**: `pending`, sin fecha → `dueDate: null`, `isOverdue: false` (CA-7); y (20) tarea creada sin `dueDate`, como las existentes tras la migración → `dueDate: null`, `isOverdue: false` (FR-022) — depende de T027
- [X] T029 [US2] [Backend · test] En el mismo fichero, filas **5-8**: (5) `in_progress` con `2026-09-29`, `?today=2026-09-30` → `isOverdue: true`; (6) **hecha**: `done` con `2026-09-01`, `?today=2026-09-30` → `isOverdue: false`, `dueDate: '2026-09-01'` (CA-9); (7) **dos husos**: una sola tarea `pending` con `2026-09-29`, dos `GET` con `?today=2026-09-30` y `?today=2026-09-29` → `isOverdue: true` y `false`, las dos con `dueDate: '2026-09-29'` (CA-19, SC-005); (8) **pasa la medianoche**: `pending` con `2026-09-30`, `?today=2026-09-30` y luego `?today=2026-10-01` sin tocar la tarea → `false` y luego `true`, y `updatedAt` de `snapshot` igual entre las dos lecturas (CA-20) — depende de T028
- [X] T030 [US2] [Backend · test] En el mismo fichero, filas **9-11** (interacciones): (9) `pending` con `2026-09-29` → `PUT …/due-date?today=2026-09-30` `{ dueDate: null }` → `isOverdue: false` en esa respuesta y en un `GET ?today=2026-09-30` posterior (CA-3); (10) `pending` con `2026-09-29` → `PATCH /api/v1/tasks/:id/status { status: 'done' }` → `GET ?today=2026-09-30` → `dueDate: '2026-09-29'`, `isOverdue: false` (CA-8, SC-004); (11) `done` con `2026-09-29` → `PATCH … { status: 'pending' }` → `GET ?today=2026-09-30` → `dueDate: '2026-09-29'`, `isOverdue: true` (User Story 2 esc. 7) — depende de T029
- [X] T031 [US2] [Backend · test] En el mismo fichero, filas **14-17**: (14) `pending` con `dueDate = DateTime.utc().minus({ days: 2 })`, `GET` **sin** query → `isOverdue: true`; (15) `pending` con `DateTime.utc().plus({ days: 2 })`, sin query → `isOverdue: false`; (16) `?today=2026-02-31` → `422`, `{ errors: [{ message: 'The today field must be a datetime value', rule: 'date', field: 'today' }] }`; (17) `?today=30/09/2026` → `422`, mismo cuerpo — depende de T030
- [X] T032 [US2] [Backend · verificación] Desde `backend/`, `node ace test functional --files=task_overdue` y confirmar que **falla en rojo por la razón correcta**: `TasksController.show` todavía ignora `?today` (usa `DateTime.utc()` desde T016), así que las filas **7, 8, 16 y 17 fallan siempre** (dos lecturas iguales donde se esperan distintas; `200` donde se espera `422`), y las de los bordes 1-3 fallan o no según el día real en que corra la suite. Las filas que ya cumple US1 (4, 6, 9-11, 14-15, 20) pueden salir en verde: son regresión. Un fallo por error de sintaxis o de import no cuenta como rojo válido. El resto de la suite sigue en verde — depende de T031

  - Nota (T029 fila 8, al implementar): igual que la fila 9 del `PUT`, se fija antes `updated_at` a un instante pasado (`backdateUpdatedAt`) para que el `snapshot` cace cualquier escritura entre las dos lecturas. En la fila 7 la segunda lectura la hace Ana (cualquier miembro lee igual); el `assignee` esperado sigue siendo Oscar.
  - Nota (T032, al implementar): rojo por la razón correcta. Fallan siempre las filas 7 y 8 (dos lecturas iguales donde se esperan distintas) y 16-17 (`200` donde se espera `422`); hoy (UTC 2026-09-29) fallan además los bordes 1 y 5 y la fila 11, que dependen del reloj porque `show` aún usa `DateTime.utc()`. En verde, como regresión: 2-4, 6, 9, 10, 14, 15 y 20. Resto de la suite en verde.

### Implementation for User Story 2 — backend

- [X] T033 [US2] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, acción `show` (contracts/task-detail-api.md, orden `401` → `422` de `today` → `404` → `200`): `const { today } = await request.validateUsing(taskReadingDayValidator, { data: request.qs() })` **antes** de `Task.findOrFail(params.id)`, y `serialize(TaskDetailTransformer.transform(task, today ?? DateTime.utc()))`. Solo se lee de la query; una petición sin `today` sigue igual que antes. Ni el modelo ni el transformer se tocan: la regla sigue solo en `Task.isOverdueOn` — depende de T032
- [X] T034 [US2] [Backend · generado + verificación] Desde `backend/`, `npm run dev` unos segundos para regenerar `backend/.adonisjs/` si la acción cambia sus tipos (commitear el diff tal cual, sin editarlo a mano); `node ace test functional --files=task_overdue` en **verde** (filas 1-11, 14-17, 20) sin haber tocado ninguna aserción de T027-T031; `npm test` entero en verde (incluidos `update_task_due_date` y `show_task`); `npm run typecheck` y `npm run lint` limpios — depende de T033

  - Nota (T034, al implementar): `task_overdue` 16/16 en verde sin tocar aserciones; `npm test` 87/87; `typecheck` y `lint` limpios. El HMR de los dev servers ya abiertos regeneró `.adonisjs/client/registry/schema.d.ts`: la `query` de `tasks.tasks.show` pasa a `ExtractQueryForGet<InferInput<taskReadingDayValidator>>`.

### Implementation for User Story 2 — frontend

- [X] T035 [US2] [Frontend · API] En `frontend/src/lib/api.ts`, `getTask(id, token)` añade `?today=${localToday()}` a `GET /api/v1/tasks/${encodeURIComponent(id)}`, con el mismo `localToday()` de T022 calculado en cada llamada (para que una pestaña abierta varios días pida con el día correcto, CA-20). Nada más de `api.ts` cambia — depende de T034
- [X] T036 [US2] [Frontend · página] En `frontend/src/pages/task-page.tsx`, la señal «Vencida» (contracts/task-due-date-ui.md → Señal «Vencida», FR-015/FR-016): una región `role="status"` que existe **siempre** junto a la fila «Vence el» (vacía si no está vencida) y que contiene el texto **«Vencida»** (`text-destructive font-medium`) solo cuando `task.isOverdue === true`; se actualiza con la respuesta de cada `setDueDate` (aparece/desaparece sin recargar, CA-3, CA-10, CA-13). El frontend **no** calcula la regla: solo pinta el booleano. Ningún «vence hoy», «vence pronto» ni otra advertencia de plazo — depende de T035
- [X] T037 [US2] [Frontend · verificación] Desde `frontend/`, `npm run build` y `npm run lint` limpios; validar a mano `quickstart.md` §3 completo (ayer/hoy/mañana/sin fecha, pasar a «Hecho» y volver, aplazar, quitar, poner una fecha pasada, dos husos cambiando la zona del navegador, medianoche) y la parte de la señal de §4 (se lee como texto y se anuncia con lector de pantalla, sin depender del color); repetir §1 para confirmar que US1 sigue igual — depende de T036

  - Nota (T037, al implementar): `npm run build` y `npm run lint` limpios. **La validación manual en navegador de `quickstart.md` §3 y de la señal en §4 (lector de pantalla, dos husos, medianoche) queda pendiente para la revisión humana**: esta ejecución no maneja un navegador.

**Checkpoint**: US1 y US2 funcionan juntas y cada una se verifica por separado; la regla está en un único sitio y sus bordes en verde.

---

## Phase 5: User Story 3 - Lo que la lista y la creación no muestran (Priority: P3)

**Goal**: La fecha es discreta: crear una tarea no la pide ni la sugiere, la lista no muestra ni la fecha ni la marca de vencida, y no tenerla no genera ningún aviso (FR-001, FR-002, FR-017, CA-1, CA-11, CA-12).

**Independent Test**: `npm test` en `backend/` con las filas 12, 13, 18 y 19 de `task_overdue.spec.ts` en verde; y en la app, `quickstart.md` §5 (la lista con tareas con fecha, vencidas y sin fecha; crear una tarea; abrir una sin fecha).

### Tests for User Story 3 (guarda de lo que no debe cambiar) ⚠️

> US3 no tiene implementación: el comportamiento ya es el actual y lo que se exige es que US1 y US2 no lo rompan (spec → Why this priority). Estos tests fijan esa frontera; no se espera que fallen en rojo, porque no hay cambio de comportamiento que introducir (la fila 19 solo pudo escribirse cuando existió el `PUT`).

- [X] T038 [US3] [Backend · test] En `backend/tests/functional/tasks/task_overdue.spec.ts`, filas **12-13** (creación): (12) `POST /api/v1/tasks { title }` → `201`; `GET /api/v1/tasks/:id?today=2026-09-30` del id creado → `dueDate: null`, `isOverdue: false` (CA-1, FR-002); (13) `POST /api/v1/tasks { title, dueDate: '2026-09-01' }` → `201`; `GET` del id → `dueDate: null` (crear ignora la fecha) — depende de T034
- [X] T039 [US3] [Backend · test] En el mismo fichero, **el test que comprueba que la lista no lleva la fecha**, filas **18-19**: (18) tres tareas —sin fecha, con fecha futura y vencida (`pending`, `2026-09-01`)— → `GET /api/v1/tasks` → `200` y, para **cada** elemento, `assert.deepEqual(Object.keys(item).sort(), ['assignee', 'createdAt', 'id', 'status', 'title'])`, sin `dueDate` ni `isOverdue` (CA-11, FR-017); (19) tarea sin fecha: fila de esa tarea en `GET /api/v1/tasks` antes, `PUT …/due-date?today=2026-09-30 { dueDate: '2026-10-15' }`, fila después → las dos filas `deepEqual` (User Story 3 esc. 4) — depende de T038
- [X] T040 [US3] [Backend · verificación] Desde `backend/`, `node ace test functional --files=task_overdue` con las 20 filas en verde y `npm test` entero en verde; `git diff 98dcd60 -- backend/app/transformers/task_transformer.ts backend/tests/functional/tasks/create_task.spec.ts backend/tests/functional/tasks/list_tasks.spec.ts backend/tests/functional/tasks/update_task_status.spec.ts` vacío, y en `backend/app/validators/task.ts` `createTaskValidator` sigue aceptando solo `title` — depende de T039

  - Nota (T038-T039, al implementar): como anticipaba el fichero, los cuatro tests de US3 salen en verde a la primera (no hay comportamiento nuevo que introducir; son guardas). En las filas 12-13 el cuerpo de `POST` se lee con `(created.body().data as TaskResponseBody).id` por el tipado del `apiClient`, y la fila 13 manda el cuerpo desde una variable (claves de más en un literal no pasan `typecheck`).
  - Nota (T040, al implementar): `task_overdue` 20/20 y `npm test` 91/91 en verde; `git diff 98dcd60` sobre `task_transformer.ts`, `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` vacío; `createTaskValidator` intacto (solo `title`).

### Verification for User Story 3 — frontend

- [X] T041 [US3] [Frontend · verificación] `git diff 98dcd60 -- frontend/src/pages/tasks-page.tsx frontend/src/components/tasks/ frontend/src/routes/` vacío (la lista, la fila, el formulario de creación y el selector de estado no se tocan); validar a mano `quickstart.md` §5: ninguna fila de la lista muestra fecha ni «Vencida», crear una tarea no ofrece ni sugiere fecha y la tarea queda sin ella, una tarea sin fecha no muestra ningún aviso, y poner/quitar una fecha no cambia su fila al volver a la lista — depende de T037, T040

  - Nota (T041, al implementar): `git diff 98dcd60 -- frontend/src/pages/tasks-page.tsx frontend/src/components/tasks/ frontend/src/routes/` vacío; en `frontend/src` solo cambian `lib/api.ts`, `lib/types.ts` y `pages/task-page.tsx`. **La validación manual en navegador de `quickstart.md` §5 queda pendiente para la revisión humana** (la parte de API de §5 la cubren las filas 12, 13, 18 y 19).

**Checkpoint**: Las tres historias completas; la lista y la creación, idénticas a antes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Comprobaciones globales, la valla y la revisión, antes de pedir revisión humana.

- [X] T042 [P] [Backend · verificación] Desde `backend/`, `quickstart.md` §0 completo: `node ace migration:rollback && node ace migration:run` deja `backend/database/schema.ts` idéntico al commiteado en T003 (`git diff --exit-code database/schema.ts`), `node ace list:routes` con `PUT /api/v1/tasks/:id/due-date` bajo `auth` y el resto igual, `npm run lint` y `npm run typecheck` limpios, y `git status .adonisjs` sin regeneraciones pendientes de commitear — depende de T041
- [X] T043 [P] [Frontend · verificación] Desde `frontend/`, `npm run build` y `npm run lint` limpios tras todas las historias — depende de T041
- [X] T044 [Cross-cutting · valla + verificación + revisión] Tarea de cierre, en este orden y **antes de pedir revisión humana**:
  1. **Valla intacta**: `git diff 98dcd60 -- backend/app/validators/user.ts backend/app/middleware/auth_middleware.ts backend/app/middleware/silent_auth_middleware.ts frontend/src/auth/` **vacío**; y vacío también sobre el resto de `BOUNDARIES.md` (`backend/app/controllers/new_account_controller.ts`, `access_tokens_controller.ts`, `profile_controller.ts`, `backend/app/models/user.ts`, las migraciones de `users` y `access_tokens`) y sobre `backend/package.json` y `frontend/package.json`. `backend/database/schema.ts` solo cambia por la regeneración de T003 (T042 lo comprueba). Si algo de esto aparece en el diff, se revierte; no se justifica.
  2. **Suite**: desde `backend/`, `npm test` en verde (previos + `update_task_due_date` + `task_overdue` + `show_task` actualizado).
  3. **Cobertura**: desde `backend/`, `npm run test:coverage`; el porcentaje de líneas de `backend/app/` no baja del suelo anotado en T001 (y nunca del `COVERAGE_MIN = 60` de `guard-tests.mjs`).
  4. **Formato**: desde `frontend/`, `npm run format`; si cambia algún fichero, revisar que solo es formato y dejarlo en el diff.
  5. **Revisión adversarial**: lanzar el subagente `adversarial-reviewer` sobre el diff completo del cambio (`git diff 98dcd60` más lo no commiteado) contra `specs/004-fecha-vencimiento/spec.md`, `plan.md`, `BOUNDARIES.md` y la constitución. Cada hallazgo bloqueante se corrige y, si hubo cambios de código, se repiten los pasos 1-4; los no bloqueantes que no se corrijan se anotan aquí con su motivo.
  6. Solo entonces: `/commit` y `gh pr create` con la descripción completa (CLAUDE.md → Reglas de proceso), y pedir revisión humana.

  — depende de T042, T043

  - Nota (T042, al implementar): `migration:rollback && migration:run` deja `schema.ts` idéntico al de T003. Como no hay commit de T003, se comparó con la copia que se guardó en T003, no con `git diff --exit-code`. `list:routes` muestra el `PUT` bajo `auth` y el resto igual; `lint` y `typecheck` están limpios. `.adonisjs/` tiene el diff regenerado sin commitear, a propósito (sin commits en esta ejecución).
  - Nota (T043, al implementar): `npm run build` y `npm run lint` limpios.
  - Nota (T044, al implementar):
    1. Valla: `git diff 98dcd60` vacío sobre toda la zona de BOUNDARIES.md, los dos `package.json` y `package-lock.json`, y los ficheros que no se tocan (`task_transformer.ts`, `task_statuses_controller.ts`, `handler.ts`, `config/`, `tasks-page.tsx`, `components/`, `routes/` y los tres specs previos).
    2. Suite: `npm test` 91/91.
    3. Cobertura: 75,68 % de líneas de `backend/app/`, por encima del suelo de 69,93 % medido en T001.
    4. `npm run format` en `frontend/` no cambia nada.
    5. `adversarial-reviewer`: APPROVE-WITH-NOTES, sin bloqueantes, sin brechas de valla y con las matrices completas. Además repitió los tests con `TZ=America/Los_Angeles` y `TZ=Pacific/Kiritimati`, en verde. De los no bloqueantes se corrigieron dos en `task-page.tsx`:
       - Una respuesta ya no repinta el campo si hay otra fecha pendiente o a medio escribir (`badInput`).
       - «Quitar fecha» siempre repinta el campo y le devuelve el foco, aunque tuviera una fecha a medias.
       Durante la corrección salió un tercer caso: si una respuesta buena no se pintó porque había otra detrás, y esa última falla, ahora se pinta la buena (lo que el servidor tiene guardado). Tras los cambios se repitieron los pasos 1-4, todos en verde.
       Quedan sin corregir dos no bloqueantes, con su motivo:
       - La validación manual en navegador (`quickstart.md` §1-§5) está pendiente para la revisión humana, porque esta ejecución no maneja un navegador.
       - Los tests de fallback usan `DateTime.utc() ± 2 días`, como pide el plan; el margen evita la inestabilidad.
    6. **No se hace**: la instrucción de esta ejecución es no commitear ni abrir PR. `/commit`, `gh pr create` y la petición de revisión humana los hace el humano.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de T001. **Bloquea todas las historias**: la migración va primero y se commitea sola, con la suite en verde.
- **US1 (Phase 3)**: depende de T003. Es el MVP.
- **US2 (Phase 4)**: depende de US1 en backend (usa `Task.isOverdueOn`, `taskReadingDayValidator`, el transformer ampliado y el `PUT` para la fila 9) y en frontend (la fila «Vence el» donde vive la señal).
- **US3 (Phase 5)**: depende de US1 (la fila 19 usa el `PUT`) y de US2 (T041 verifica la lista con tareas vencidas visibles en el detalle).
- **Polish (Phase 6)**: depende de las tres historias.

### Orden de capas dentro del backend

migración (T002) → `schema.ts` regenerado y commiteado (T003) → tests en rojo de US1 (T004-T012) → modelo `isOverdueOn` (T013) ∥ validadores (T014) → transformer (T015) → `show` con `DateTime.utc()` (T016) ∥ controlador del `PUT` (T017) → ruta (T018) → `.adonisjs/` (T019) → verde (T020) → tests en rojo de US2 (T027-T032) → `show` lee `today` (T033) → verde (T034) → guardas de US3 (T038-T040).

### Orden de capas dentro del frontend

tipos (T021) → `api.ts` con `setDueDate` (T022) → fila «Vence el» (T023) → guardado automático (T024) → errores (T025) → [US2] `getTask` con `today` (T035) → señal «Vencida» (T036). El endpoint va siempre antes que la interfaz que lo usa: T026 depende de T020 y T035 de T034.

### Within Each User Story

- Tests escritos y ejecutados en **rojo** antes de la implementación (T012 antes de T013; T032 antes de T033).
- Modelo antes que transformer; transformer antes que controladores; controlador antes que ruta; ruta antes que código generado.
- Backend en verde antes de verificar el frontend de esa historia.

### Parallel Opportunities

- T011 (`show_task.spec.ts`) en paralelo con T004-T010 (`update_task_due_date.spec.ts`).
- T013 (`models/task.ts`) en paralelo con T014 (`validators/task.ts`).
- T021 (`lib/types.ts`) desde que termina T003, en paralelo con todo el backend de US1; T022-T025 pueden escribirse contra el contrato mientras el backend avanza, pero T026 los verifica contra T020.
- T042 y T043 en paralelo.
- Los tests de un mismo fichero (T004-T010, T027-T031, T038-T039) son secuenciales entre sí.

---

## Parallel Example: User Story 1

```bash
# Tests en rojo, dos ficheros a la vez:
Task: "T004-T010 Matriz del PUT en backend/tests/functional/tasks/update_task_due_date.spec.ts"
Task: "T011 Actualizar expectedBody y 'coincide con la lista' en backend/tests/functional/tasks/show_task.spec.ts"

# Tras el rojo (T012), dominio y validación a la vez:
Task: "T013 Task.isOverdueOn(today) en backend/app/models/task.ts"
Task: "T014 calendarDay(), updateTaskDueDateValidator y taskReadingDayValidator en backend/app/validators/task.ts"

# Frontend en paralelo con el backend, contra el contrato:
Task: "T021 TaskDetail en frontend/src/lib/types.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: línea base (T001).
2. Phase 2: migración y `schema.ts` regenerado, commiteados (T002-T003).
3. Phase 3: US1 completa (T004-T026).
4. **STOP and VALIDATE**: matriz del `PUT` y `show_task` en verde; `quickstart.md` §1-§2.

### Incremental Delivery

1. Setup + Foundational → la columna existe, nada visible cambia.
2. US1 → poner/cambiar/quitar la fecha desde la vista (MVP).
3. US2 → la señal «Vencida» con el día de quien mira.
4. US3 → guardas de la lista y la creación.
5. Polish → valla, suite, cobertura, formato, `adversarial-reviewer`, PR.

Un único PR para FS-118 (Principio V); los checkpoints son puntos de validación, no entregas separadas.

---

## Notes

- [P] = archivo distinto y sin dependencias pendientes.
- Verificar que cada test falla antes de implementar; nunca editar una aserción para que pase.
- `backend/database/schema.ts` y `backend/.adonisjs/` solo se regeneran; se commitean tal cual salen.
- `guard-tests.mjs` bloquea `git commit` con la suite en rojo y `gh pr create` con la cobertura por debajo del suelo: no hay commits intermedios entre T012 y T020 ni entre T032 y T034.
- Si al implementar algo contradice `plan.md`/`research.md`/`contracts/`, se anota bajo la tarea como «Nota (Txxx, decidido al implementar)» con el motivo, como en `specs/003-abrir-tarea/tasks.md`.

## Phase 7: Convergence

> Brecha detectada por `/speckit-converge` (2026-09-30) a partir del test en rojo `backend/tests/functional/tasks/vence_hoy.spec.ts`: `Task.isOverdueOn` compara con `<=` y marca como vencida una tarea que vence hoy, y tres filas de la matriz de `task_overdue.spec.ts` no son las del contrato. Orden obligatorio: T045 → T046 (rojo) → T047 → T048 (verde). `guard-tests.mjs` bloquea commits con la suite en rojo: no hay commit intermedio entre T045 y T048.

- [X] T045 CRITICAL [US2] [Backend · test] En `backend/tests/functional/tasks/task_overdue.spec.ts`, devolver la matriz a la que fija `contracts/task-detail-api.md` (T028, T029), sin tocar ninguna otra aserción: (fila 2) añadir al `.with([...])` del test de bordes `{ name: 'mismo día', dueDate: '2026-09-30', today: TODAY, isOverdue: false }` (CA-5), que hoy falta; (fila 7) en «dos días de referencia», la lectura de Ana con `?today=2026-09-29` (no `2026-09-28`) → `isOverdue: false`; (fila 8) en «pasa la medianoche», la primera lectura con `?today=2026-09-30` (el mismo día, no `2026-09-29`) → `false`, y la segunda con `2026-10-01` → `true`. Las tres desviaciones son las que dejaban pasar la regla `<=`. `vence_hoy.spec.ts` se deja tal cual, como el test del bug que falla antes y pasa después per Constitution II, US2/AC2, US2/AC11, US2/AC12 (contradicts)
- [X] T046 [US2] [Backend · verificación] Desde `backend/`, `node ace test functional --files=task_overdue --files=vence_hoy` y confirmar que **falla en rojo por la razón correcta**: solo fallan `vence_hoy.spec.ts`, la fila 2 (mismo día), la lectura de Ana de la fila 7 y la primera lectura de la fila 8, todas con `isOverdue: true` donde se espera `false`; el resto del fichero en verde. Un fallo por sintaxis o import no cuenta como rojo válido (ojo: la suite trunca `tmp/db.sqlite3`, el mismo fichero del dev server) — depende de T045, per Constitution II (partial)
- [X] T047 [US2] [Backend · modelo] En `backend/app/models/task.ts`, `isOverdueOn`: cambiar `this.dueDate.toISODate()! <= today.toISODate()!` por `<`, para que la fecha tenga que ser **estrictamente anterior** al día de referencia (data-model.md → La regla, research.md §2, T013). El JSDoc ya dice «strictly before» y se queda igual; ni el transformer, ni los controladores, ni el frontend se tocan (la regla sigue en un único sitio) — depende de T046, per FR-011, US2/AC2, SC-003 (contradicts)
- [X] T048 [US2] [Backend · verificación] Desde `backend/`, `npm test` con la suite completa en verde (incluidos `vence_hoy.spec.ts` y las filas de T045), `npm run typecheck` y `npm run lint` limpios, y `npm run test:coverage` sin bajar del suelo de T001 (Lines 69,93 %). Incluir en el commit `vence_hoy.spec.ts`, que hoy está sin versionar — depende de T047, per Constitution II, SC-003 (partial)
  - Nota (T048, decidido al implementar): suite 118/118 en verde, `typecheck` y `lint` limpios, `test:coverage` Lines 76,94 % (suelo 69,93 %). El commit (con `vence_hoy.spec.ts` incluido) queda fuera de esta ejecución por indicación expresa: no se commitea aquí.
- [X] T049 [US2] [Backend · test] En `backend/tests/functional/tasks/task_overdue.spec.ts`, completar SC-003 («los cuatro bordes combinados con "Hecho" y no "Hecho"»): hoy solo está «hecha con fecha pasada» (fila 6); añadir con `?today=2026-09-30` y cuerpo completo las tres combinaciones `done` que faltan —mismo día (`2026-09-30`), día posterior (`2026-10-01`) y sin fecha—, todas `isOverdue: false` y con la fecha intacta. Son tests de cobertura de la regla ya corregida: deben pasar en verde a la primera — depende de T048, per SC-003, US2/AC6 (partial)
