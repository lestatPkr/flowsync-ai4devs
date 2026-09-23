---

description: "Task list for Crear tarea con solo el título"
---

# Tasks: Crear tarea con solo el título

**Input**: Design documents from `/specs/001-crear-tarea/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/tasks-api.md](./contracts/tasks-api.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. La historia P1 (US1) lleva un test funcional Japa escrito y en rojo antes de su implementación (Principio II de la constitución); `backend/tests/functional/` no existe todavía y su creación es parte de este cambio.

**Organization**: Tareas agrupadas por historia de usuario (US1/US2/US3 de `spec.md`), en orden de dependencias. Ninguna tarea rediseña lo que `plan.md`/`research.md`/`data-model.md` ya decidieron — solo lo ejecuta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2, US3)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React), comandos ejecutados desde cada carpeta (ver `plan.md` → Project Structure).

---

## Phase 1: Setup

**Purpose**: Infraestructura mínima compartida, sin dependencias nuevas.

- [X] T001 [P] Crear la carpeta `backend/tests/functional/tasks/` (no existe ninguna carpeta `functional/` todavía; ver `research.md` sección 6)
- [X] T002 [P] Crear la carpeta `frontend/src/components/tasks/`

**Checkpoint**: Carpetas listas para recibir tests y componentes de las historias.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modelo de datos, endpoint base y navegación que las tres historias necesitan antes de poder implementarse.

**⚠️ CRITICAL**: Ninguna historia (US1/US2/US3) empieza antes de que esta fase esté completa.

- [X] T003 Crear la migración `backend/database/migrations/<timestamp>_create_tasks_table.ts` con la tabla `tasks`: `id` (`increments`, PK), `title` (`string`, `NOT NULL`), `status` (`string`, `NOT NULL`, default `'pending'`), `assignee_id` (`integer unsigned`, `NOT NULL`, FK → `users.id`, `onDelete('CASCADE')`), `created_at` (`timestamp`, `NOT NULL`, autoCreate), `updated_at` (`timestamp` nullable, autoCreate + autoUpdate) — tabla de campos exacta en `data-model.md` → Entidad Task
- [X] T004 Ejecutar `node ace migration:run` desde `backend/` para aplicar T003 y regenerar `backend/database/schema.ts` (clase `TaskSchema`); no editar ese archivo a mano (BOUNDARIES.md) — depende de T003
- [X] T005 [P] Crear `backend/app/models/task.ts` extendiendo `TaskSchema` generado, con el enum `TaskStatus = 'pending' | 'in_progress' | 'done'` (catálogo cerrado, FR-004) y la relación `assignee = belongsTo(() => User, { foreignKey: 'assigneeId' })` — depende de T004
- [X] T006 [P] Crear `backend/app/transformers/task_transformer.ts` exponiendo `id`, `title`, `status`, `assignee` (`id`, `fullName`, `initials`) y `createdAt`, siguiendo la forma de `data-model.md` → Serialización — depende de T005
- [X] T007 Crear `backend/app/controllers/tasks_controller.ts` con la clase `TasksController` vacía (sin métodos todavía; `store` e `index` los añaden US1 y US2) — depende de T005, T006
- [X] T008 Añadir el grupo de rutas `/api/v1/tasks` en `backend/start/routes.ts`: `prefix('tasks')`, `.use(middleware.auth())`, `POST /` → `[controllers.Tasks, 'store']`, `GET /` → `[controllers.Tasks, 'index']`, como grupo hermano de `account` dentro del `prefix('/api/v1')` existente (NO anidado en `account`; ver `research.md` sección 2); arrancar `node ace serve` o correr los tests para regenerar `backend/.adonisjs/server/controllers.ts` y commitear el diff — depende de T007
- [X] T009 [P] Añadir los tipos `Task` y `TaskStatus` en `frontend/src/lib/types.ts`, espejo de `TaskTransformer` (T006): `{ id, title, status, assignee: { id, fullName, initials }, createdAt }`
- [X] T010 Crear `frontend/src/pages/tasks-page.tsx` como página contenedora (layout base con huecos para el formulario, la lista y el estado vacío que las historias siguientes rellenan) — depende de T009
- [X] T011 Cambiar el destino de la ruta protegida tras iniciar sesión en `frontend/src/routes/app-routes.tsx` de `/profile` a `/tasks` (nueva `TasksPage`), incluyendo el `Navigate` de `path="*"`; `/profile` se mantiene accesible como ruta protegida, solo deja de ser la landing (`research.md` sección 5) — depende de T010

**Checkpoint**: Backend expone `/api/v1/tasks` (sin lógica todavía) y el frontend aterriza en `/tasks` tras login. Las historias pueden empezar.

---

## Phase 3: User Story 1 - Crear una tarea escribiendo solo el título (Priority: P1) 🎯 MVP

**Goal**: Un miembro con sesión iniciada crea una tarea escribiendo solo el título; queda asignada a quien la crea, en estado "Pendiente", sin pedir ni sugerir ningún otro dato (FR-001 a FR-007).

**Independent Test**: Con sesión iniciada, enviar `POST /api/v1/tasks` con `{ "title": "..." }` y comprobar que la tarea se crea con `status: "pending"` y `assignee` = quien hizo la petición; comprobar también el rechazo de título vacío/solo-espacios y de título > 200 caracteres.

### Tests for User Story 1 ⚠️

> Escribir este test PRIMERO y comprobar que falla antes de implementar T013-T014.

- [X] T012 [P] [US1] Escribir `backend/tests/functional/tasks/create_task.spec.ts` (usando el `apiClient` de Japa y los hooks `testUtils.db()`) cubriendo los Acceptance Scenarios 1-4 de la User Story 1 de `spec.md`: (a) título válido → `201`, `status: "pending"`, `assignee.id` = usuario autenticado; (b) título vacío o solo espacios → `422` con error en el campo `title`, ninguna tarea creada; (c) título con espacios al principio/final → se guarda recortado; (d) título de más de 200 caracteres → `422`, ninguna tarea creada, sin truncar — contrato de referencia en `contracts/tasks-api.md`

### Implementation for User Story 1

- [X] T013 [US1] Crear `backend/app/validators/task.ts` con `createTaskValidator = vine.create({ title: vine.string().trim().minLength(1).maxLength(200) })` (regla exacta de `data-model.md` → Reglas de validación)
- [X] T014 [US1] Implementar `TasksController.store` en `backend/app/controllers/tasks_controller.ts`: validar el body con `createTaskValidator` (T013), crear la `Task` con `assigneeId = auth.getUserOrFail().id` y `status` por defecto `'pending'` — ambos fijados por el servidor, nunca leídos del body — y devolver `serialize(TaskTransformer.transform(task))` con código `201` — depende de T013, T008
- [X] T015 [US1] Ejecutar `node ace test functional --files=create_task` desde `backend/` y confirmar que T012 pasa en verde — depende de T014
- [X] T016 [P] [US1] Añadir el tipo `CreateTaskPayload` (`{ title: string }`) y la función `createTask(payload, token)` en `frontend/src/lib/api.ts`: `POST /api/v1/tasks`, desenvolviendo `{ data }` igual que `signup`/`login`
- [X] T017 [US1] Crear `frontend/src/components/tasks/task-form.tsx`: formulario de un solo campo (título), reutilizando `components/ui/input.tsx`, `label.tsx` y `button.tsx`; al enviarse con éxito limpia el campo; si el backend responde `422`, muestra `error.fieldErrors.title` bajo el input (mismo patrón `ApiError` que `login-page`/`register-page`) — depende de T016
- [X] T018 [US1] Integrar `TaskForm` en `frontend/src/pages/tasks-page.tsx`: al crear una tarea con éxito, añadirla al estado local de tareas en memoria sin recargar la página ni navegar (FR-008) — depende de T017, T011

**Checkpoint**: User Story 1 funciona de punta a punta y es demostrable por sí sola (crear tarea vía formulario, ver el rechazo de título vacío/largo).

---

## Phase 4: User Story 2 - Ver la tarea recién creada en la lista (Priority: P2)

**Goal**: La lista de tareas del espacio compartido muestra, sin abrir cada tarea, su título, su responsable y su estado (FR-008, FR-009).

**Independent Test**: Con al menos una tarea ya creada (US1), pedir `GET /api/v1/tasks` y comprobar que cada elemento trae `title`, `status` y `assignee`; en el frontend, comprobar que la lista pinta esos tres datos sin navegar a una vista de detalle.

### Tests for User Story 2 ⚠️

> Escribir este test PRIMERO y comprobar que falla antes de implementar T021.

- [X] T019 [P] [US2] Escribir `backend/tests/functional/tasks/list_tasks.spec.ts`: `GET /api/v1/tasks` devuelve **todas** las tareas del espacio compartido (no solo las del usuario que consulta), cada elemento incluye `title`, `status` y `assignee`, el orden es `createdAt` descendente, y un espacio sin tareas devuelve `{ "data": [] }` — contrato de referencia en `contracts/tasks-api.md`

### Implementation for User Story 2

- [X] T020 [US2] Implementar `TasksController.index` en `backend/app/controllers/tasks_controller.ts`: `Task.query().orderBy('createdAt', 'desc')` y devolver `serialize(TaskTransformer.transform(tasks))` — depende de T019 (test escrito), T008
- [X] T021 [US2] Ejecutar `node ace test functional --files=list_tasks` desde `backend/` y confirmar que T019 pasa en verde — depende de T020
- [X] T022 [US2] Añadir la función `listTasks(token)` en `frontend/src/lib/api.ts`: `GET /api/v1/tasks`, desenvolviendo `{ data }` — depende de T016 (mismo archivo, secuencial)
- [X] T023 [US2] Crear `frontend/src/components/tasks/task-list.tsx`: pinta título, responsable (`assignee.fullName`) y estado de cada tarea sin necesidad de abrirla (FR-009), mapeando `pending → "Pendiente"`, `in_progress → "En curso"`, `done → "Hecho"` — depende de T022
- [X] T024 [US2] Integrar `TaskList` en `frontend/src/pages/tasks-page.tsx`: cargar las tareas con `listTasks()` al montar la página y mostrarlas con `TaskList` — depende de T023, T018

**Checkpoint**: User Story 1 y 2 funcionan juntas: crear una tarea y verla en la lista con sus tres datos, sin recargar.

---

## Phase 5: User Story 3 - Espacio sin tareas todavía (Priority: P3)

**Goal**: Un espacio compartido sin ninguna tarea muestra una explicación y una vía directa para crear la primera, en vez de una lista vacía sin contexto (FR-010).

**Independent Test**: Con la base de datos sin ninguna tarea (`node ace migration:fresh`), abrir la lista y comprobar que aparece el mensaje de estado vacío con la opción de crear la primera tarea, y que esa opción lleva al mismo flujo de creación de US1.

### Implementation for User Story 3

> No requiere test funcional de backend nuevo: `GET /api/v1/tasks` ya cubre el caso `{ "data": [] }` en T019. Esta historia es puramente de presentación en el frontend.

- [X] T025 [P] [US3] Crear `frontend/src/components/tasks/empty-tasks-state.tsx`: explica qué es la lista de tareas y ofrece un botón/enlace para crear la primera tarea (FR-010) — depende de T011
- [X] T026 [US3] Integrar `EmptyTasksState` en `frontend/src/pages/tasks-page.tsx`: mostrarlo en vez de `TaskList` cuando la lista de tareas cargada esté vacía, y que su acción enfoque/abra el mismo `TaskForm` de US1 — depende de T025, T024

**Checkpoint**: Las tres historias funcionan de forma independiente y en conjunto: crear, ver en lista, y ver el estado vacío cuando corresponde.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final de calidad, de la valla de seguridad y de la spec completa antes de pedir revisión humana.

- [X] T027 Ejecutar `npm run typecheck` y `npm run lint` en `backend/`, y `npm run build` (que incluye el typecheck) y `npm run lint` en `frontend/`, sobre todos los archivos tocados por T001-T026
- [X] T028 Ejecutar `node ace test functional` desde `backend/` (suite completa) y confirmar que corre en verde, incluyendo `create_task.spec.ts` y `list_tasks.spec.ts`
- [X] T029 Validar a mano los tres escenarios de `quickstart.md` de punta a punta (crear con título vacío/largo/válido, ver en lista, espacio vacío con `node ace migration:fresh`)
- [X] T030 Confirmar que `backend/app/validators/user.ts`, los middlewares de autenticación (`backend/app/middleware/auth_middleware.ts`, `backend/app/middleware/silent_auth_middleware.ts`) y `frontend/src/auth/` no tienen ningún cambio en el diff de la rama (`git diff main -- backend/app/validators/user.ts backend/app/middleware/auth_middleware.ts backend/app/middleware/silent_auth_middleware.ts frontend/src/auth/` debe salir vacío), y a continuación lanzar el subagente `adversarial-reviewer` sobre el diff completo de la rama contra `specs/001-crear-tarea/spec.md`, `specs/001-crear-tarea/plan.md` y `BOUNDARIES.md` — esta tarea se completa **antes** de pedir revisión humana o abrir el PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias — arranca de inmediato
- **Foundational (Phase 2)**: depende de Setup — BLOQUEA las tres historias
- **User Story 1 (Phase 3)**: depende de Foundational; es la única con dependencia estructural cero hacia otra historia
- **User Story 2 (Phase 4)**: depende de Foundational; su parte de frontend (T024) se integra sobre la página que ya modificó US1 (T018), así que en la práctica se implementa después de US1 aunque su endpoint (T020) es independiente
- **User Story 3 (Phase 5)**: depende de Foundational y de que `tasks-page.tsx` ya tenga la carga de la lista de US2 (T024) para poder decidir cuándo mostrar el estado vacío en vez de la lista
- **Polish (Phase 6)**: depende de que las tres historias estén completas

### Dentro de cada historia

- Tests (cuando los hay) se escriben y deben fallar antes de la implementación (T012 antes de T013-T014; T019 antes de T020)
- Validador/modelo antes que el controlador; controlador antes que la verificación del test en verde
- Backend (API) antes que el consumo desde `frontend/src/lib/api.ts`; `api.ts` antes que el componente que lo usa; componente antes que su integración en `tasks-page.tsx`

### Parallel Opportunities

- T001 y T002 (Setup) en paralelo
- T005 y T006 (Foundational, tras T004) en paralelo — archivos distintos
- T009 (Foundational, frontend) en paralelo con la rama backend de Foundational (T003-T008)
- T012 (test US1) puede escribirse en paralelo con T016 (frontend `api.ts` de US1) — no comparten archivo
- T019 (test US2) puede escribirse en paralelo con el resto de Foundational/US1 una vez esa fase esté cerrada
- T025 (componente `empty-tasks-state.tsx` de US3) puede crearse en paralelo con el resto de US2, ya que no depende de T020-T024 — solo su integración (T026) sí depende de T024

---

## Parallel Example: Foundational

```bash
# Tras T004 (migración aplicada), lanzar en paralelo:
Task: "Crear backend/app/models/task.ts con TaskStatus y la relación assignee"
Task: "Añadir los tipos Task y TaskStatus en frontend/src/lib/types.ts"
```

## Parallel Example: User Story 1

```bash
# En paralelo, antes de implementar el controlador:
Task: "Escribir backend/tests/functional/tasks/create_task.spec.ts"
Task: "Añadir CreateTaskPayload y createTask() en frontend/src/lib/api.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Completar Phase 1: Setup
2. Completar Phase 2: Foundational (bloqueante)
3. Completar Phase 3: User Story 1
4. **Parar y validar**: crear una tarea de punta a punta (formulario → API → base de datos), probar título vacío y título largo
5. Con esto ya hay valor demostrable: "puedo anotar en qué ando en segundos"

### Incremental Delivery

1. Setup + Foundational → base lista
2. + User Story 1 → demo: crear tarea (MVP)
3. + User Story 2 → demo: crear y verla en la lista con título/responsable/estado
4. + User Story 3 → demo: espacio nuevo con mensaje de bienvenida en vez de vacío sin contexto
5. Phase 6 (Polish) → tests, lint, valla de seguridad y `adversarial-reviewer` antes del PR

---

## Notes

- Ninguna tarea introduce una dependencia nueva ni toca `backend/database/schema.ts` a mano (BOUNDARIES.md); el esquema se regenera con `node ace migration:run` (T004).
- El grupo de rutas `/api/v1/tasks` es hermano de `account`, no anidado en él (T008; ver `research.md` sección 2) — las rutas existentes no cambian.
- T030 es la tarea de cierre obligatoria: confirma que la zona vallada de autenticación queda intacta y pasa el `adversarial-reviewer` antes de pedir revisión humana o abrir el PR.
