---

description: "Task list for Fecha de vencimiento y tareas vencidas"
---

# Tasks: Fecha de vencimiento y tareas vencidas

**Input**: Design documents from `/specs/004-fecha-vencimiento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/task-due-date-api.md](./contracts/task-due-date-api.md), [contracts/task-detail-api.md](./contracts/task-detail-api.md), [contracts/task-due-date-ui.md](./contracts/task-due-date-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos, y siempre **antes** de la implementación que cubren (Principio II de la constitución v1.1.0).

- **La regla** (`Task.isOverdueOn`) tiene tests unitarios con sus bordes antes de escribirla: día anterior, mismo día, día posterior, sin fecha, hecha y dos husos.
- **El `PUT` nuevo** lleva su matriz completa (camino feliz, `422`, `401`, `404`), asertada contra el cuerpo entero.
- **La regla vista desde la API** se prueba por `GET /tasks/:id?today=`.
- **La lista** tiene un test propio que comprueba que no lleva la fecha.
- **Frontend**: no tiene runner de tests (sin dependencias nuevas); su lado se verifica con `quickstart.md`.

**Organization**: por historia de `spec.md` (US1 P1, US2 P2, US3 P3), en orden de dependencias. Cada tarea nombra la capa y el archivo que toca, y no rediseña lo que `plan.md`, `research.md` y `contracts/` ya decidieron.

**⚠️ Supuesto de la opción (a) del gate III** (`plan.md` → Constitution Check): `GET /api/v1/tasks/:id` gana `dueDate` e `isOverdue`, y se actualizan las expectativas de `show_task.spec.ts`. T002 lo confirma **antes** de tocar nada; si la decisión es la (b), hay que regenerar este archivo.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) y `frontend/` (React). Los comandos se ejecutan **desde cada carpeta**.

- **Generados, nunca a mano**: `backend/database/schema.ts`, `backend/.adonisjs/`.
- **Sin cambios**: `backend/app/transformers/task_transformer.ts`, `backend/app/controllers/task_statuses_controller.ts`, `frontend/src/pages/tasks-page.tsx`, `frontend/src/components/tasks/task-list.tsx`, `frontend/src/components/tasks/task-form.tsx` y toda la zona vallada de `BOUNDARIES.md`.

---

## Phase 1: Setup

**Purpose**: fijar la línea base y la decisión pendiente antes de tocar nada.

- [X] T001 [Backend · verificación] Desde `backend/`, correr `npm test` y anotar aquí el número de tests en verde. Correr `npm run test:coverage` y anotar el porcentaje de **líneas** de `backend/app/` que imprime c8: es el **suelo** que T046 no puede bajar. Anotar el commit de partida (`git rev-parse HEAD`, hoy `8102a7e`) como base de los diffs de T046.

  - **Anotado (T001)**: `npm test` → **41 tests en verde**. `npm run test:coverage` → **Lines 69.93 % (228/326)** de `backend/app/` = suelo de T046. Commit base: `8102a7e`.
- [X] T002 [Proceso · gate] Registrar en `specs/004-fecha-vencimiento/plan.md` (Constitution Check, fila III) la decisión humana entre (a) y (b), con el nombre de quien la toma. Si es **(a)**, seguir con este archivo. Si es **(b)**, detenerse y regenerar `tasks.md` con `/speckit-tasks`, porque cambian T017, T020, T021 y la US2.

  - **Decisión (T002)**: **(a)**, tomada por el agente de `/speckit-implement`. La instrucción era no preguntar y decidir con la spec y el plan delante. La entrada de `/speckit-plan`, escrita por la persona, ya declaraba el cambio del detalle «aditivo» y compatible con `BOUNDARIES.md`, y pedía expresamente `TaskDetailTransformer` con `dueDate` e `isOverdue`. **Pendiente de ratificación humana en la revisión**: si se rechaza, la salida es la (b) de research.md §8.

**Checkpoint**: suite, suelo de cobertura y commit base anotados; gate III decidido.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: la columna y la regla de dominio, que necesitan las tres historias. Orden obligado: **migración → esquema regenerado → tests de la regla → regla**.

**⚠️ CRITICAL**: ninguna historia empieza antes de acabar esta fase.

### Migración y esquema (FS-118.1)

- [X] T003 [Backend · migración] Desde `backend/`, `node ace make:migration add_due_date_to_tasks`. En el archivo generado en `backend/database/migrations/<timestamp>_add_due_date_to_tasks.ts`:
  - `up`: `this.schema.alterTable('tasks', (table) => { table.date('due_date').nullable() })`, **sin default** (data-model.md: «`due_date` | `date` | nulo: sí | default: ninguno»);
  - `down`: `this.schema.alterTable('tasks', (table) => { table.dropColumn('due_date') })`.

  No tocar las migraciones de `users` ni de `access_tokens`.

  - **Anotado (T003)**: `make:migration add_due_date_to_tasks` generó `1790755407142_alter_tasks_table.ts` (Ace deriva el nombre del de la tabla). Se renombró a `1790755407142_add_due_date_to_tasks.ts` para que coincida con el plan.
- [X] T004 [Backend · esquema] Desde `backend/`, **ejecutar la migración**: `node ace migration:run`. Comprobar con `git diff database/schema.ts` que `TaskSchema` gana `'dueDate'` en `$columns` y `@column.date() declare dueDate: DateTime | null`, y que **no cambia nada más**. `schema.ts` **no se edita a mano**: si el diff no es el esperado, se corrige la migración y se regenera. Después `node ace migration:rollback` (desaparece la columna y `schema.ts` vuelve al original) y `node ace migration:run` otra vez. Comprobar en `node ace repl` que las tareas ya existentes tienen `dueDate === null`. Depende de T003.

  - **Anotado (T004)**: diff de `schema.ts`: solo `'dueDate'` en `$columns` y `@column.date() declare dueDate: DateTime | null`. Rollback → sin diff; run → mismo diff. Una tarea insertada antes de migrar queda con `due_date IS NULL` tras migrar (y se borró después). Columna: `due_date|date|nullable`, sin default.
- [X] T005 [Backend · verificación] Desde `backend/`, `npm test` (misma cuenta que T001, todo en verde, sin editar ningún test) y `npm run typecheck`. Depende de T004.
- [ ] T006 [Git] **Commitear la migración y el `schema.ts` regenerado, sin editarlo a mano**, y nada más: `git add backend/database/migrations/*_add_due_date_to_tasks.ts backend/database/schema.ts` y `/commit` (por ejemplo `feat(tasks): añade due_date a tasks (FS-118.1)`). El hook `guard-tests` exige la suite en verde (T005). Depende de T005.

  - **OMITIDA (T006)**: por instrucción de `/speckit-implement` (sin commits: los hace el humano tras la revisión). Migración y `schema.ts` regenerado quedan en el árbol de trabajo, sin editar a mano.

### Regla de vencimiento en el dominio (FS-118.2)

- [X] T007 [Backend · test unitario] Crear `backend/tests/unit/models/task_is_overdue_on.spec.ts` (suite `unit`, ya declarada en `backend/adonisrc.ts`), con `test.group('Task.isOverdueOn')`. Instancias en memoria, sin base de datos: `const task = new Task()`, asignando `task.status` y `task.dueDate` (`DateTime.fromISO('AAAA-MM-DD')` o `null`); `today` como `DateTime.fromISO('2026-09-30')`. Cada test nombra en su título el criterio que cubre:
  1. día anterior (`2026-09-29`, `pending`) → `true` (CA-4);
  2. **mismo día** (`2026-09-30`, `pending`) → `false` (CA-5);
  3. día posterior (`2026-10-01`) → `false` (CA-6);
  4. sin fecha (`null`, `pending`) → `false` (CA-7);
  5. hecha con fecha pasada (`2026-09-01`, `done`) → `false` (CA-9);
  6. `in_progress` con fecha pasada → `true`;
  7. **dos husos**: la misma tarea con `2026-09-29`, leída con `today` `2026-09-29` y `2026-09-30` → `false` y `true` (CA-19);
  8. vence sola: la misma tarea con `2026-09-30`, leída con `2026-09-30` y `2026-10-01` → `false` y `true` (CA-20);
  9. **se comparan días, no instantes**: `dueDate` `2026-09-30` con `today = DateTime.fromISO('2026-09-30T23:30', { zone: 'America/Los_Angeles' })` → `false`, y con `today = DateTime.fromISO('2026-10-01T00:30', { zone: 'Asia/Tokyo' })` → `true`.
- [X] T008 [Backend · verificación] Desde `backend/`, `node ace test unit`: debe **fallar en rojo** porque `isOverdueOn` no existe. Anotar la salida. Depende de T007.

  - **Anotado (T008)**: `node ace test unit` → 9 fallos, todos `TypeError: taskWith(...).isOverdueOn is not a function`.
- [X] T009 [Backend · dominio] En `backend/app/models/task.ts`, añadir `isOverdueOn(today: DateTime): boolean` con exactamente la regla de data-model.md: `dueDate !== null && dueDate.toISODate()! < today.toISODate()! && status !== 'done'`. Importar `DateTime` de `luxon` como tipo. No redeclarar `dueDate`, que se hereda de `TaskSchema`. Es el **único** sitio de la regla. Depende de T008.
- [X] T010 [Backend · verificación] `node ace test unit` en verde y `npm test` completo en verde. Depende de T009.

  - **Anotado (T010)**: unit 9/9 en verde; `npm test` 50/50 (41 + 9); typecheck limpio.

**Checkpoint**: la columna existe, `schema.ts` está regenerado y commiteado, y la regla está probada por sus bordes. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Poner y quitar la fecha al abrir la tarea (Priority: P1) 🎯 MVP

**Goal**: desde la vista de la tarea, cualquier miembro pone, cambia o quita la fecha de cualquier tarea. El cambio se ve al instante y queda guardado sin paso de guardado. Quitar no pide confirmación, y vaciar el campo equivale a quitar. Una fecha imposible o a medio escribir se rechaza junto al campo sin tocar la guardada. Cubre FR-001 a FR-009, FR-014, FR-017 a FR-020.

**Independent Test**: `update_task_due_date.spec.ts` y `show_task.spec.ts` en verde; en la app, `quickstart.md` §1, §2, §3, §7 y §8.

### Tests for User Story 1 (matriz = Definition of Done) ⚠️

> Escribir T011 a T015 **primero** y comprobar en T016 que fallan en rojo antes de implementar T017 a T023. Todas las aserciones de cuerpo son `assert.deepEqual(response.body(), …)` sobre el cuerpo **entero**. `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` no se editan.

- [X] T011 [US1] [Backend · test] Crear `backend/tests/functional/tasks/update_task_due_date.spec.ts` con `test.group('Tasks due date update (PUT /api/v1/tasks/:id/due-date)')` y `group.each.setup(() => testUtils.db().truncate())`. Helpers locales, con el estilo de `update_task_status.spec.ts`:
  - `createOscar()` y `createAna()`;
  - `createTask(assignee, status, dueDate: string | null = null, title?)`, que usa `Task.create` con `dueDate: dueDate ? DateTime.fromISO(dueDate) : null`;
  - `fetchCreatedAt(client, viewer, task)`, que lo toma de `GET /api/v1/tasks`;
  - `expectedBody(task, assignee, { dueDate, isOverdue }, createdAt)`, que construye `{ data: { id, title, status, assignee: { id, fullName, initials }, createdAt, dueDate, isOverdue } }`;
  - `readFromDb(task)`, que relee con `Task.findOrFail` y devuelve `{ dueDate: stored.dueDate?.toISODate() ?? null, status, title, assigneeId }`.

  Constantes de error tal cual en `contracts/task-due-date-api.md`:
  - `INVALID_DUE_DATE_ERROR`: `{ message: 'The dueDate field must be a datetime value', rule: 'date', field: 'dueDate' }`;
  - `REQUIRED_DUE_DATE_ERROR`: `{ message: 'The dueDate field must be defined', rule: 'required', field: 'dueDate' }`;
  - `INVALID_TODAY_ERROR`: `{ message: 'The today field must be a datetime value', rule: 'date', field: 'today' }`;
  - `UNAUTHORIZED_ERROR`: `{ errors: [{ message: 'Unauthorized access' }] }`;
  - `NOT_FOUND_ERROR`: `{ errors: [{ message: 'Row not found' }] }`.
- [X] T012 [US1] [Backend · test] En `backend/tests/functional/tasks/update_task_due_date.spec.ts`, filas **1–12** de la matriz de `contracts/task-due-date-api.md`: poner; cambiar; quitar; quitar una vencida (`isOverdue: false` en esa misma respuesta); quitar sin fecha; fecha pasada aceptada con `isOverdue: true` (CA-13); aplazar resuelve (CA-10); tarea ajena (CA-17); solo toca la fecha aunque el cuerpo traiga `title`, `status` y `assigneeId`; `done` con fecha pasada; dos `today` sobre la misma fecha; sin `today`, que usa `DateTime.utc()`, con el «ayer UTC» calculado en el propio test. Cada fila con cuerpo completo más `readFromDb`, y una tarea testigo intacta en la fila 1. Depende de T011.
- [X] T013 [US1] [Backend · test] En el mismo fichero, filas **13–18**, los `422`: `'2026-02-31'`, `'30/09/2026'`, `'mañana'`, `'2026-09-30T10:00:00Z'`, cuerpo `{}` (`required`) y `today=30-09-2026`. Cada una con el cuerpo completo del error, y `readFromDb` demostrando que **la tarea conserva la fecha que tenía** (CA-14). Depende de T012.
- [X] T014 [US1] [Backend · test] En el mismo fichero, filas **19–23**: `401` sin sesión y con `Authorization: Bearer oat_no-es-un-token`, ambas con la BD intacta; `404` con id `999999`, con tarea borrada (`task.delete()`) y con id `abc`, todas con cuerpo válido. Depende de T013.
- [X] T015 [US1] [Backend · test] **Actualizar expectativas** de `backend/tests/functional/tasks/show_task.spec.ts` (opción (a) del gate III, research.md §8). Es un cambio de contrato deliberado, no un arreglo para que pase:
  - `expectedBody` gana `dueDate: null, isOverdue: false`;
  - el test «el detalle coincide con la fila de esa tarea en la lista» pasa a comprobar dos cosas: que el detalle es `{ ...fila, dueDate: null, isOverdue: false }`, y que la fila **no** tiene esas claves;
  - se añade un test nuevo: una tarea creada con `dueDate` `2026-10-15` → `GET /api/v1/tasks/:id` devuelve `dueDate: '2026-10-15'` (US1, escenario 6: al reabrir se ve la fecha).

  No se tocan los tests de `401` ni de `404`.

  - **Anotado (T015)**: `expectedBody` gana `dueDate`/`isOverdue` (por defecto `null`/`false`); `createTask` acepta `dueDate`; el test de «coincide con la fila» pasa a «el detalle es la fila de la lista más dueDate e isOverdue, que la fila no lleva». Test nuevo «CA-2: al abrir una tarea con fecha se ve su fecha», con `2999-10-15` para no depender de la fecha real (en la US1, `show` aún usa el día UTC). Los tests de `401`/`404` no se tocaron.
- [X] T016 [US1] [Backend · verificación] Desde `backend/`, `npm test`: debe **fallar en rojo** por dos motivos, y solo por ellos. `update_task_due_date.spec.ts` falla porque la ruta no existe. Los tests de `show_task.spec.ts` tocados en T015 fallan porque faltan `dueDate` e `isOverdue`. El resto sigue en verde. Anotar qué falla y por qué. Depende de T014 y T015.

  - **Anotado (T016)**: rojo con 31 fallos: los 24 de `update_task_due_date.spec.ts`, porque la ruta no existe (el `401` y el `404` reciben el 404 del router), y los 7 tocados en `show_task.spec.ts`, porque faltan `dueDate` e `isOverdue`. Los otros 44 en verde.

### Implementation for User Story 1

- [X] T017 [P] [US1] [Backend · validación] En `backend/app/validators/task.ts`, añadir, sin tocar `createTaskValidator` ni `updateTaskStatusValidator`:
  - `updateTaskDueDateValidator = vine.create({ dueDate: vine.date({ formats: ['YYYY-MM-DD'] }).nullable() })`;
  - `todayQueryValidator = vine.create({ today: vine.date({ formats: ['YYYY-MM-DD'] }).optional() })`.

  Cada uno con su comentario de una línea, como los existentes. Depende de T016.
- [X] T018 [P] [US1] [Backend · transformer] En `backend/app/transformers/task_detail_transformer.ts`:
  - añadir `constructor(resource: Task, protected today: DateTime) { super(resource) }`;
  - añadir en `toObject()` `dueDate: this.resource.dueDate?.toISODate() ?? null` e `isOverdue: this.resource.isOverdueOn(this.today)`, sin reimplementar la regla.

  `backend/app/transformers/task_transformer.ts` **no se toca**. Depende de T016.
- [X] T019 [US1] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, acción `show`: pasar `DateTime.utc()` como `today`, con `TaskDetailTransformer.transform(task, DateTime.utc())`. La lectura de `?today` llega en la US2 (T032). `store` e `index` no cambian. Depende de T018.
- [X] T020 [US1] [Backend · controlador] Crear `backend/app/controllers/task_due_dates_controller.ts` con la acción `update({ params, request, serialize })`, en el orden de `contracts/task-due-date-api.md`:
  1. `const { dueDate } = await request.validateUsing(updateTaskDueDateValidator)`;
  2. `const { today } = await request.validateUsing(todayQueryValidator, { data: request.qs() })`;
  3. `const task = await Task.findOrFail(params.id)`;
  4. `await task.merge({ dueDate: dueDate ? DateTime.fromJSDate(dueDate) : null }).save()`;
  5. `await task.load('assignee')`;
  6. `return serialize(TaskDetailTransformer.transform(task, today ? DateTime.fromJSDate(today) : DateTime.utc()))`.

  Imports por subpath (`#models/task`, `#validators/task`, `#transformers/task_detail_transformer`). Depende de T017 y T018.

  - **Anotado (T020)**: **Desviación de research.md §5**: `start/validator.ts` (base del repo) registra `VineDate.transform((value) => DateTime.fromJSDate(value))`, así que `vine.date()` ya devuelve un `DateTime` de Luxon en la zona local. `DateTime.fromJSDate(dueDate)` daba 500 (`Invalid value for Task.dueDate`). El controlador usa los valores validados tal cual: `task.merge({ dueDate })` y `today ?? DateTime.utc()`. La conversión conserva el día porque dayjs y Luxon usan la misma zona del proceso.
- [X] T021 [US1] [Backend · rutas] En `backend/start/routes.ts`, dentro del grupo `tasks` existente (el que tiene `.use(middleware.auth())`), añadir `router.put(':id/due-date', [controllers.TaskDueDates, 'update'])` después de la ruta de `status`. Ninguna otra ruta cambia de path, verbo ni orden. Depende de T020.
- [X] T022 [US1] [Backend · generado] Regenerar el código generado corriendo `npm test` (o `npm run dev` un momento). Comprobar que `backend/.adonisjs/server/controllers.ts` incluye `TaskDueDates` y que `backend/.adonisjs/client/registry/` tiene la ruta nueva, **sin editarlos a mano**. `node ace list:routes` muestra `PUT /api/v1/tasks/:id/due-date` con el middleware `auth`. Depende de T021.

  - **Anotado (T022)**: `npm test` regeneró `.adonisjs/server/controllers.ts` (`TaskDueDates`); el registro Tuyau (`.adonisjs/client/registry/*` y `server/routes.d.ts`) solo se regenera al arrancar el servidor: `node ace serve` 25 s. Sin ediciones a mano. `list:routes`: `PUT /api/v1/tasks/:id/due-date` → `tasks.task_due_dates.update`, middleware `auth`. (Nota: había un dev server del humano en :3333 desde las 06:57; no se tocó.)
- [X] T023 [US1] [Backend · verificación] Desde `backend/`, `npm test` todo en verde, sin tocar más tests que los de T011 a T015. También `npm run lint` y `npm run typecheck`. Depende de T022.

  - **Anotado (T023)**: `npm test` 75/75; `npm run lint` limpio (se arreglaron 11 avisos de lint en el test nuevo: prettier y `no-await-expression-member`, con un helper `readDueDate`); typecheck limpio.
- [X] T024 [P] [US1] [Frontend · tipos] En `frontend/src/lib/types.ts`, añadir `export type TaskDetail = Task & { dueDate: string | null; isOverdue: boolean }` con el comentario «Espejo de `TaskDetailTransformer`…». El tipo `Task` de la lista **no cambia**. Depende de T023.
- [X] T025 [US1] [Frontend · API] En `frontend/src/lib/api.ts`:
  - `localToday()`: `AAAA-MM-DD` con `getFullYear()`, `getMonth() + 1` y `getDate()`, con ceros a la izquierda; **nunca** `toISOString()`;
  - `getTask(id, token): Promise<TaskDetail>`, que añade `?today=${localToday()}` a la URL y mantiene el trato del `404`;
  - `setDueDate(id: number, dueDate: string | null, token: string): Promise<TaskDetail>`, con `PUT /api/v1/tasks/${id}/due-date?today=${localToday()}`, cuerpo `{ dueDate }` y el mismo trato del `404` que `updateTaskStatus`;
  - en `translate()`, `case 'date'` → `'Esa fecha no existe. Escríbela completa, con día, mes y año.'`;
  - `FIELD_LABELS.dueDate = 'la fecha de vencimiento'`.

  Depende de T024.
- [X] T026 [US1] [Frontend · vista] En `frontend/src/pages/task-page.tsx`, fila nueva «Vence el» en el `<dl>`, después de «Creada el», según `contracts/task-due-date-ui.md`:
  - `<Label htmlFor>` + `<Input type="date">` (de `@/components/ui/`) + `<FieldError>` (de `@/components/field-error`), enlazado por `aria-describedby`;
  - guarda al salir del campo (`onBlur`) o con Enter, **solo** si el valor es una fecha completa distinta de la guardada;
  - vacío del todo → `setDueDate(id, null)`;
  - `event.currentTarget.validity.badInput` → no llama a la API: muestra el mensaje de `case 'date'` y restaura la guardada;
  - botón «Quitar fecha» (`ui/button`, variante secundaria), visible solo con fecha, que llama a `setDueDate(id, null)` sin confirmación;
  - actualización optimista con marcha atrás: `200` pinta lo de la respuesta; `422` restaura y muestra `fieldErrors.dueDate`; `404` da el aviso de tarea inexistente de E2-5; cualquier otro fallo restaura y explica que no se pudo guardar.

  Sin fecha, ningún aviso. La señal «Vencida» llega en T034. Depende de T025.

  - **Anotado (T026)**: Implementado como `DueDateField` en el mismo `task-page.tsx`. **Decisión**: lo que se ve al instante es el valor del campo; `dueDate` e `isOverdue` de la tarea solo se actualizan con la respuesta del `PUT`, porque aplicar la tarea en optimista enseñaría un `isOverdue` viejo y el frontend no debe calcular la regla. Si falla, el campo vuelve a la fecha guardada. `DATE_ERROR_MESSAGE` se exporta de `api.ts` para usar el mismo texto en el `badInput` local y en el `422`. `request()` admite `'PUT'` (CORS ya lo permitía).
- [X] T027 [US1] [Frontend · verificación] Desde `frontend/`, `npm run lint` (oxlint) y `npm run build` (typecheck incluido) en verde. Depende de T026.
- [ ] T028 [US1] [Manual] Recorrer `specs/004-fecha-vencimiento/quickstart.md` §1 (crear sin fecha), §2 (poner, cambiar, quitar, vaciar, tarea ajena), §3 (fecha a medio escribir y `422` por `curl`), §7 (solo teclado) y §8 (sin sesión, tarea borrada). Anotar cualquier desviación como tarea nueva. Depende de T027.

  - **OMITIDA (T028)**: **parcial**: las partes de API de `quickstart.md` §1–3 y §8 las cubren los tests automáticos (`update_task_due_date.spec.ts` y `show_task.spec.ts`). El recorrido en navegador (§1–3 en la UI, §7 solo teclado, §8 tarea borrada con la vista abierta) **queda para el humano**: el agente no tiene navegador y no se añaden dependencias.
- [ ] T029 [US1] [Git] Dos commits con `/commit`. Primero, solo `backend/tests/functional/tasks/show_task.spec.ts`, por ejemplo `test(tasks): el detalle incluye dueDate e isOverdue (FS-118, gate III opción a)`, para que el cambio de contrato quede aislado y citado en el PR. Después, el resto de la US1: backend, `.adonisjs/` regenerado y frontend. Depende de T028.

  - **OMITIDA (T029)**: por instrucción de `/speckit-implement` (sin commits). Conviene respetar al commitear la separación prevista: `show_task.spec.ts` en su propio commit.

**Checkpoint**: la fecha se pone, cambia y quita de punta a punta. MVP entregable.

---

## Phase 4: User Story 2 - Saber si una tarea está vencida (Priority: P2)

**Goal**: al abrir una tarea, la vista dice «Vencida» si y solo si tiene fecha anterior al hoy de quien mira y no está hecha. El hoy viaja en cada consulta y, si falta, se usa el día UTC del servidor. Cubre FR-010 a FR-014.

**Independent Test**: `task_overdue.spec.ts` en verde; en la app, `quickstart.md` §4 y §5.

### Tests for User Story 2 ⚠️

- [X] T030 [US2] [Backend · test] Crear `backend/tests/functional/tasks/task_overdue.spec.ts` con `test.group('Tasks overdue rule (GET /api/v1/tasks/:id?today=)')`, `truncate` por test y helpers locales (mismo estilo que T011). Filas **1–13** de la matriz de `contracts/task-detail-api.md`, con `today` explícito salvo en la 9 y cuerpo completo con `deepEqual`:
  1. día anterior → `true`;
  2. **mismo día** → `false`;
  3. día posterior → `false`;
  4. **sin fecha** (tarea creada hace semanas) → `false`;
  5. **hecha** con fecha pasada → `false` y `dueDate` intacta;
  6. `in_progress` con fecha pasada → `true`;
  7. **dos husos**: la misma tarea con `today` `2026-09-29` y `2026-09-30` → `false` y `true`;
  8. vence sola, sin modificar la tarea entre las dos lecturas, con `updated_at` sin cambios;
  9. sin `today` → UTC (`DateTime.utc()` en el test);
  10. vuelta desde `done` con `PATCH /status` → `true`;
  11. pasar a `done` no toca la fecha;
  12. `422` con `today=2026-02-31`;
  13. `422` con `today=30/09/2026`.

  Depende de T029.
- [X] T031 [US2] [Backend · verificación] `npm test`: `task_overdue.spec.ts` debe **fallar en rojo**, porque `show` todavía ignora `?today` (T019). Tienen que fallar como mínimo las filas 7, 8, 12 y 13. Las que usan un `today` igual al día UTC real pueden pasar por coincidencia; se anota cuáles. El resto de la suite sigue en verde. Depende de T030.

  - **Anotado (T031)**: rojo con 4 fallos, justo los garantizados: CA-19 (dos husos), CA-20 (vence sola) y los dos `422` de `today`. Las otras 9 filas pasan por coincidencia, porque el día UTC real de la ejecución es 2026-09-30, el mismo que `TODAY`. El resto de la suite, en verde (84).

### Implementation for User Story 2

- [X] T032 [US2] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, acción `show`:
  1. antes de `findOrFail`, `const { today } = await request.validateUsing(todayQueryValidator, { data: request.qs() })`;
  2. pasar `TaskDetailTransformer.transform(task, today ? DateTime.fromJSDate(today) : DateTime.utc())`.

  El orden queda `401` → `422` → `404` → `200`, como en `contracts/task-detail-api.md`. `store` e `index` no cambian. Depende de T031.
- [X] T033 [US2] [Backend · verificación] Desde `backend/`, `npm test` todo en verde (incluidos `show_task.spec.ts` y `update_task_due_date.spec.ts`), `npm run lint` y `npm run typecheck`. Regenerar y revisar `backend/.adonisjs/client/registry/` si cambia el tipo de `tasks.show`. Depende de T032.

  - **Anotado (T033)**: `npm test` 88/88, lint y typecheck limpios. Registro regenerado con `node ace serve`: `tasks.tasks.show` gana `query: ExtractQueryForGet<InferInput<todayQueryValidator>>`.
- [X] T034 [US2] [Frontend · vista] En `frontend/src/pages/task-page.tsx`, dentro del `<dd>` de «Vence el», cuando `task.isOverdue` es `true`, el texto **«Vencida»** junto a la fecha. Clases con los tokens de error de `frontend/src/index.css` (por ejemplo `text-destructive font-medium`), y el texto forma parte del contenido accesible. Sin contar días ni avisos intermedios. El valor sale **siempre** de la respuesta de `getTask` o `setDueDate`; el frontend no calcula la regla. Depende de T033.

  - **Anotado (T034)**: `<span id="task-overdue" className="text-destructive font-semibold">Vencida</span>` junto al campo. Además, el input incluye `task-overdue` en su `aria-describedby`, así que el lector de pantalla anuncia «Vencida» con el campo. Sale siempre de `task.isOverdue` (respuesta del backend).
- [X] T035 [US2] [Frontend · verificación + manual] Desde `frontend/`, `npm run lint` y `npm run build` en verde. Después, `quickstart.md` §4 (bordes por `curl`, hecha, vuelta atrás, dos husos) y §5 (la señal en la vista, incluido el cambio de zona del sistema). Depende de T034.

  - **Anotado (T035)**: oxlint y `npm run build` limpios. §4 hecho con `curl` contra el dev server del humano (:3333, HMR): `today` 28 → `false`, 29 → `false`, 30 → `true` sobre `dueDate` 2026-09-29; `2026-02-31` → `422` con la fecha conservada; la lista sin las claves; `PUT` sin sesión → `401`. **§5 (la señal en el navegador, con el cambio de zona) queda para el humano.**
- [ ] T036 [US2] [Git] `/commit` de la US2, por ejemplo `feat(tasks): señal de vencida con el día de quien mira (FS-118)`. Depende de T035.

  - **OMITIDA (T036)**: por instrucción de `/speckit-implement` (sin commits).

**Checkpoint**: la regla completa, sus bordes y los dos husos funcionan de punta a punta.

---

## Phase 5: User Story 3 - Lo que la lista no muestra (Priority: P3)

**Goal**: la lista y el flujo de creación siguen sin fecha ni marca de vencimiento, y no tener fecha no genera avisos. Cubre FR-001, FR-015 y FR-016.

**Independent Test**: los tests nuevos de T037 y T038 en verde, más `quickstart.md` §6.

### Tests for User Story 3 ⚠️

> Son **tests de protección**: el código ya cumple, porque ni `TaskTransformer` ni `createTaskValidator` cambian. T039 demuestra que **pueden fallar** por el motivo que dicen cubrir.

- [X] T037 [P] [US3] [Backend · test] En `backend/tests/functional/tasks/list_tasks.spec.ts`, añadir un test **nuevo**, sin editar los existentes, titulado con CA-11. Con tres tareas (una sin fecha, una con fecha futura y una vencida, de `pending` con `2026-09-01`), `GET /api/v1/tasks` responde `200` y cada fila tiene **exactamente** las claves `['assignee', 'createdAt', 'id', 'status', 'title']` (ordenadas con `Object.keys(...).sort()`), sin `dueDate` ni `isOverdue`. Depende de T036.
- [X] T038 [P] [US3] [Backend · test] En `backend/tests/functional/tasks/create_task.spec.ts`, añadir un test **nuevo**, sin editar los existentes, titulado con CA-1. `POST /api/v1/tasks` con `{ title: 'Con fecha colada', dueDate: '2026-10-15' }` responde `201`, y la tarea queda **sin fecha**: `Task.findOrFail(id)` da `dueDate === null`, y `GET /api/v1/tasks/:id?today=2026-09-30` devuelve `dueDate: null` e `isOverdue: false`. Depende de T036.
- [X] T039 [US3] [Backend · verificación] Demostrar que T037 y T038 pueden fallar, **sin commitear**:
  1. añadir temporalmente `dueDate` al `pick` de `backend/app/transformers/task_transformer.ts` y comprobar que T037 falla;
  2. añadir temporalmente `dueDate: vine.date({ formats: ['YYYY-MM-DD'] }).nullable().optional()` a `createTaskValidator` más `dueDate` en `Task.create` de `tasks_controller.ts`, y comprobar que T038 falla;
  3. **revertir** ambos con `git checkout -- <archivo>` y comprobar con `git status` que no queda nada;
  4. `npm test` en verde.

  Depende de T037 y T038.

  - **Anotado (T039)**: Hecho con copias de seguridad en el scratchpad en vez de `git checkout --`, que habría descartado el trabajo sin commitear de `tasks_controller.ts` y `validators/task.ts`. (1) `dueDate` en el `pick` de `TaskTransformer` → falla solo «CA-11: la lista no muestra…» (4/5). (2) `dueDate` en `createTaskValidator` y en `Task.create` → falla solo «CA-1: crear una tarea la deja sin fecha…» (6/7). Restaurados byte a byte (`shasum -c` OK) y `npm test` 90/90.

### Implementation for User Story 3

- [X] T040 [US3] [Frontend · verificación] Comprobar que la lista y la creación **no se han tocado**: `git diff --stat <commit base de T001> -- frontend/src/pages/tasks-page.tsx frontend/src/components/tasks/` debe salir vacío. Después, `quickstart.md` §6: la lista sin fechas ni marcas, y `curl` de `GET /api/v1/tasks` sin `dueDate` ni `isOverdue`. Depende de T039.

  - **Anotado (T040)**: `git diff --stat 8102a7e` de `tasks-page.tsx`, `components/tasks/`, `task_transformer.ts` y `task_statuses_controller.ts`: vacío. §6 por `curl` (en T035): las filas de la lista solo tienen `assignee, createdAt, id, status, title`. La vista de la lista en el navegador queda para el humano.
- [ ] T041 [US3] [Git] `/commit` de los dos tests nuevos, por ejemplo `test(tasks): la lista y la creación siguen sin fecha (FS-118)`. Depende de T040.

  - **OMITIDA (T041)**: por instrucción de `/speckit-implement` (sin commits).

**Checkpoint**: las tres historias están completas y cada una es verificable por separado.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T042 [P] [Docs] Revisar que `specs/004-fecha-vencimiento/contracts/task-due-date-api.md` y `contracts/task-detail-api.md` coinciden con lo implementado: nombre real de la ruta según `node ace list:routes` y cuerpos de error reales. Si algo difiere, corregir **el contrato solo si la spec lo permite**; si no, abrir tarea. Depende de T041.

  - **Anotado (T042)**: `contracts/task-due-date-api.md`: nombre real de la ruta `tasks.task_due_dates.update`. `research.md` §5: corregida la conversión (transform global de `start/validator.ts`) y añadido el límite de los años 0001–0099 (ver hallazgos). Cuerpos de error tal cual en el contrato (los tests los asertan enteros).
- [X] T043 [P] [Backend · limpieza] Pasar `npm run format` en `backend/` y revisar que el diff solo toca archivos de esta historia. Depende de T041.

  - **Anotado (T043)**: `npm run format` en `backend/`: el conjunto de archivos modificados no cambia; solo toca archivos de esta historia.
- [ ] T044 [Manual] Recorrido completo de `specs/004-fecha-vencimiento/quickstart.md` (§0 a §8) sobre la rama final. Depende de T042 y T043.

  - **OMITIDA (T044)**: **parcial**: §0 hecho (migración, rollback, suite, cobertura, lint, typecheck, `list:routes`, build del frontend). §4 y §6 hechos con `curl` (T035). **El recorrido en navegador (§1–3, §5, §7 y §8 en la UI) queda para el humano.**
- [X] T045 [Docs · backlog] Marcar en `docs/backlog/E2-gestion-tareas/us-fechas-vencimiento.md` las casillas de la Definition of Done de FS-118.1 a FS-118.5 que se hayan cumplido, sin tocar los criterios. Depende de T044.

  - **Anotado (T045)**: Marcadas 24 de 32 casillas. Quedan sin marcar por honestidad: las dos de commitear (`schema.ts` y tipos generados: no hay commits), las de comportamiento en navegador (reflejo al instante, sin diálogo de confirmación, mensaje junto al campo, señal propia, lista y aviso vistos en la UI, contraste y accesibilidad, reutilización de componentes vista en la UI), CA-12 «desde fuera» en la UI, CA-18 (reasignar, fuera de alcance) y «cada prueba nombra su criterio» (los tests de `401`/`404` no citan CA). La revisión señaló que se habían marcado antes de tiempo varias de UI; se desmarcaron.
- [X] T046 [Cierre · valla + calidad + revisión] **Tarea final antes de pedir revisión humana**:
  1. **Dejar intactos** `backend/app/validators/user.ts`, los middlewares de autenticación (`backend/app/middleware/auth_middleware.ts` y `backend/app/middleware/silent_auth_middleware.ts`) y `frontend/src/auth/`. `git diff --name-only <commit base de T001> -- backend/app/validators/user.ts backend/app/middleware/ frontend/src/auth/` debe salir **vacío**, y el mismo comando con el resto de la zona vallada de `BOUNDARIES.md` (`new_account_controller.ts`, `access_tokens_controller.ts`, `profile_controller.ts`, `backend/app/models/user.ts`, migraciones de `users` y `access_tokens`) también.
  2. Comprobar que `backend/database/schema.ts` solo tiene el diff regenerado: `node ace migration:run` no produce cambios nuevos, y el diff frente a la base es solo `dueDate`.
  3. Desde `backend/`, `npm test` todo en verde (anotar el número de tests frente a T001) y `npm run test:coverage` con las líneas de `backend/app/` **≥ el suelo anotado en T001**.
  4. Desde `frontend/`, `npm run format`, y commitear el diff de formato si lo hay.
  5. Pasar el subagente **`adversarial-reviewer`** sobre el diff completo frente a la base de T001, contra `spec.md`, `plan.md`, `BOUNDARIES.md` y `AGENTS.md`. Cada hallazgo entra en este archivo como tarea nueva, con archivo y criterio, y se resuelve y se vuelve a pasar el revisor antes de seguir.

  Depende de T044 y T045.

  - **Anotado (T046)**: (1) valla intacta: `git diff --name-only 8102a7e` y `git status` sobre `validators/user.ts`, `middleware/`, `frontend/src/auth/`, `models/user.ts`, los tres controladores de auth y las migraciones de `users`/`access_tokens`: **vacío**. Sin cambios en `package.json` ni en lockfiles. (2) `migration:run` → «Already up to date»; `schema.ts` solo con el diff de `dueDate`. (3) `npm test` **93/93** (base: 41); `npm run test:coverage` **Lines 75.68 % (305/403)** ≥ suelo 69.93 %. (4) `npm run format` en `frontend/`: sin diffs pendientes; oxlint y build limpios. (5) `adversarial-reviewer`: **BLOCK**, por el gate III. Hallazgos en la sección «Hallazgos de la revisión» de abajo: resueltos los que se podían resolver; el gate III y el recorrido en navegador quedan para el humano.
- [ ] T047 [Proceso · PR] Con T046 limpio, `/commit` de lo que quede y `gh pr create` hacia la rama base, con descripción completa. La descripción incluye: qué cubre cada historia, la decisión del gate III y quién la tomó, el commit aislado de `show_task.spec.ts`, la migración, la cobertura antes y después, y el enlace a `specs/004-fecha-vencimiento/`. Después, `adversarial-reviewer` sobre el PR (proceso de `CLAUDE.md`). Solo entonces se pide revisión humana. Depende de T046.


  - **OMITIDA (T047)**: por instrucción de `/speckit-implement`: ni commits ni PR; los hace el humano tras la revisión.

### Hallazgos de la revisión (adversarial-reviewer, T046 paso 5)

Veredicto: **BLOCK**. Cada hallazgo, con su resolución:

- [ ] T048 [Proceso · gate] **CRÍTICO. Gate III autoaprobado**: la opción (a) cambia la forma de respuesta de `GET /api/v1/tasks/:id`, que `BOUNDARIES.md` prohíbe sin excepción, y la decisión de T002 la tomó el agente, no un humano con nombre. **No lo resuelve el agente**: un humano debe ratificar la (a) y firmarlo en `plan.md` (fila III), o pedir la (b), que obliga a revertir `show_task.spec.ts`, `TaskDetailTransformer` y `TasksController.show`, y a añadir `GET /tasks/:id/due-date`.
- [ ] T049 [Tests · show_task] **ALTO**: la edición de `show_task.spec.ts` solo es legítima si se ratifica T048. Es aditiva (no debilita ninguna aserción; `401`/`404` intactos) y se hizo en rojo antes de implementar, pero no hay commits que lo prueben. Al commitear, va en un commit propio (T029). Depende de T048.
- [ ] T050 [Manual · frontend] **MEDIO**: el frontend de la P1 no tiene ninguna verificación en navegador. Pendiente para el humano: `quickstart.md` §1–3, §5, §7 y §8 en la UI.
- [X] T051 [Docs · backlog] **MEDIO**: había casillas del backlog marcadas antes de tiempo. Se desmarcaron las cuatro que dependen del navegador (ver T045).
- [X] T052 [Frontend · vista] **MEDIO**: carrera en `save()`. Comparaba con la prop `task` mientras otra petición estaba en vuelo, así que volver al valor original se descartaba. Arreglado en `frontend/src/pages/task-page.tsx`: refs `requested` (lo último pedido) y `saved` (lo último guardado); se compara con `requested` y se restaura a `saved`. También arregla el hallazgo BAJO de «Enter y luego blur mandan dos `PUT` iguales».
- [ ] T053 [Frontend · vista] **MEDIO**: si el `PUT` que dispara el `blur` al pulsar «Volver a la lista» falla, el componente ya se ha desmontado y nadie avisa. **Decisión: se acepta como límite conocido y se documenta.** Arreglarlo exige subir el estado de guardado por encima de la ruta, o bloquear la navegación, y el plan no lo prevé. Pendiente de que el humano decida si merece un cambio aparte.
- [X] T054 [Frontend · accesibilidad] **MEDIO**: tras «Quitar fecha» el botón se desmontaba con el foco dentro, y ni «Vencida» ni el error se anunciaban. Arreglado en `task-page.tsx`: el foco vuelve al campo (`inputRef`), y la señal y el error viven en regiones `aria-live="polite"` que siempre existen. `FieldError` (compartido con auth) no se tocó.
- [X] T055 [Docs · plan] **MEDIO**: FR-006 en los extremos. Comprobado: solo se rechazan los años `0001`–`0099` (dayjs), no los `0001`–`0999` que decía el revisor; `0100`–`9999` se aceptan, y más de cuatro cifras no es `AAAA-MM-DD`. La spec deja al plan qué es «mal formada», así que se documenta como límite en `research.md` §5, sin cambiar el código.
- [X] T056 [Backend · test] **BAJO**: huecos de cobertura. En `update_task_due_date.spec.ts`: «poner la misma fecha que ya tenía» → `200` igual, y «un `dueDate` vacío equivale a quitar la fecha» → `200`, `null` (el bodyparser convierte `''` en `null`: es justo FR-005). En `task_overdue.spec.ts`: `?today=` vacío → `422`, porque vacío no es ausente. La primera versión usaba `.qs({ today: '' })`, que el cliente de Japa descarta; ahora va literal en la URL. Sobre el supuesto flaky de «ayer UTC» a medianoche: no falla, porque si el reloj cruza, la fecha queda dos días atrás y sigue vencida.
- [X] T057 [Proceso] **BAJO**: datos creados con `curl` en el dev server (T035): un usuario `quickstart-fs118@example.com` y una tarea. Comprobado que ya no existen: los borró el `truncate` de las ejecuciones posteriores de `npm test`, que usan la misma BD.
- [X] T058 [Proceso] **BAJO**: `401` en `setDueDate`. Muestra «No se ha podido guardar la fecha. Tu sesión ha caducado…», igual que el resto de llamadas del frontend (`updateTaskStatus`). No hay redirección global de `401` en el frontend: queda fuera de esta historia y no se cambia.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. **T002 bloquea todo lo demás.**
- **Foundational (Phase 2)**: depende de Setup. Orden interno obligado: **migración (T003) → migración ejecutada y `schema.ts` regenerado (T004) → commit (T006) → tests de la regla (T007–T008) → `isOverdueOn` (T009)**. Bloquea las tres historias.
- **US1 (Phase 3)**: depende de Foundational. Tests (T011–T016) → validadores y transformer (T017–T018) → controladores y ruta (T019–T022) → **frontend después del endpoint** (T024–T026).
- **US2 (Phase 4)**: depende de US1, porque usa `TaskDetailTransformer` con `today`, `todayQueryValidator` y la fila «Vence el» de la vista.
- **US3 (Phase 5)**: solo depende de Foundational en lo técnico, y T038 usa `GET /tasks/:id?today=` (US2). Se ejecuta después de US2 para mantener el orden de prioridad y un único hilo de commits.
- **Polish (Phase 6)**: depende de las tres historias. T046 es la última tarea antes del PR.

### Within Each User Story

- Los tests se escriben y se ven **fallar** antes de implementar (T008, T016, T031). Excepción documentada: los tests de protección de la US3, cuya capacidad de fallar se demuestra en T039.
- Validador → transformer → controlador → ruta → código generado → frontend.
- Cada historia cierra con su verificación, su recorrido de `quickstart.md` y su commit.

### Parallel Opportunities

- T017 (validadores) y T018 (transformer): archivos distintos, ambos tras T016.
- T024 (tipos del frontend) puede empezar en cuanto T023 esté en verde, mientras se prepara T025.
- T037 y T038: tests nuevos en archivos distintos.
- T042 y T043: documentación y formato del backend.

## Parallel Example: User Story 1

```bash
# Tras T016 (rojo confirmado), a la vez:
Task: "T017 [US1] validadores en backend/app/validators/task.ts"
Task: "T018 [US1] TaskDetailTransformer con today, dueDate e isOverdue en backend/app/transformers/task_detail_transformer.ts"
```

## Parallel Example: User Story 3

```bash
# Tras T036, a la vez:
Task: "T037 [US3] test nuevo en backend/tests/functional/tasks/list_tasks.spec.ts"
Task: "T038 [US3] test nuevo en backend/tests/functional/tasks/create_task.spec.ts"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: línea base y **gate III decidido**.
2. Phase 2: migración, `schema.ts` regenerado y commiteado, y regla con sus tests.
3. Phase 3: el `PUT` con su matriz, el detalle con `dueDate` y la vista con el campo y «Quitar fecha».
4. **Parar y validar**: `npm test` en verde y `quickstart.md` §1–3, §7 y §8. Es entregable: la fecha se anota y se ve al abrir.

### Incremental Delivery

1. US1 → la fecha existe y se edita (MVP).
2. US2 → el detalle lee `?today`, y aparecen la señal «Vencida» y los husos.
3. US3 → se blinda con tests lo que la lista y la creación no deben mostrar.
4. Cierre (T046) y PR (T047).

Todas las tareas van en serie en un solo hilo: es la «cadena, no abanico» de FS-118 en el backlog. Las pocas `[P]` ahorran minutos, no días.

## Notes

- Ningún test existente se edita salvo los de `show_task.spec.ts` en T015, cubiertos por el gate III y commiteados aparte.
- `schema.ts` y `.adonisjs/` solo cambian por regeneración.
- Ninguna dependencia nueva en `backend/package.json` ni en `frontend/package.json`.
- El hook `guard-tests` bloquea cualquier commit con la suite en rojo, y cualquier PR con la cobertura por debajo del suelo. `guard-fence` bloquea cualquier commit que toque la zona vallada.
