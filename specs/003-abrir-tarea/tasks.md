---

description: "Task list for Abrir una tarea de la lista"
---

# Tasks: Abrir una tarea de la lista

**Input**: Design documents from `/specs/003-abrir-tarea/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/task-detail-api.md](./contracts/task-detail-api.md), [contracts/task-detail-ui.md](./contracts/task-detail-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Incluidos. La historia P1 (US1) lleva la **matriz de comportamiento completa** del endpoint (camino feliz, `401`, `404`; el `422` no aplica, research.md §4) en `backend/tests/functional/tasks/show_task.spec.ts`, escrita y ejecutada en **rojo** antes de tocar transformer, controlador y ruta (Principio II de la constitución v1.1.0). El frontend no tiene runner de tests (fuera de alcance, sin dependencias nuevas): US1 y US2 se verifican a mano en su lado de cliente con `quickstart.md`.

**Organization**: Tareas agrupadas por historia de usuario (US1/US2 de `spec.md`), en orden de dependencias. Cada tarea nombra la capa y el archivo que toca. Ninguna tarea rediseña lo que `plan.md`/`research.md`/`contracts/` ya decidieron: solo lo ejecuta.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: Historia a la que pertenece (US1, US2)
- Rutas de archivo exactas en cada descripción

## Path Conventions

Web app existente: `backend/` (AdonisJS) + `frontend/` (React), comandos ejecutados desde cada carpeta (ver `plan.md` → Project Structure). **Sin migración y solo lectura** (`data-model.md`): `backend/database/schema.ts`, `backend/app/models/task.ts`, `backend/app/transformers/task_transformer.ts`, `backend/app/exceptions/handler.ts` y `frontend/src/lib/types.ts` no cambian.

---

## Phase 1: Setup

**Purpose**: Fijar la línea base antes de tocar nada, para poder demostrar después que no se rompe ni baja nada.

- [X] T001 [Backend · verificación] Desde `backend/`, correr `npm test` y confirmar que `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` están en verde en la rama sin cambios; correr `npm run test:coverage` y anotar el porcentaje de líneas de `backend/app/` que imprime el `text-summary` de c8 (config en `backend/.c8rc.json`) como **suelo de referencia** para T024. Anotar también el commit de partida (`git rev-parse HEAD`, hoy `e861fdd`) como base del diff de la valla en T024

  - **Anotado (T001)**: `npm test` → 30 tests en verde (`create_task`, `list_tasks`, `update_task_status`). `npm run test:coverage` → **Lines 67.65% (205/303)** de `backend/app/` = suelo de T024. Commit base: `e861fdd31e8733ef571a60e4479bf3d7f23bd6b8`.

**Checkpoint**: Suite en verde, cobertura de partida y commit base anotados.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ninguna. El modelo `Task` con `belongsTo assignee`, el grupo de rutas `tasks` protegido por `middleware.auth()`, la rama `E_ROW_NOT_FOUND → 404` de `app/exceptions/handler.ts` (E2-4), el tipo `Task` del frontend, `ProtectedRoute` y la lista con su `<TaskStatusSelect>` ya existen (`specs/001-crear-tarea/`, `specs/002-cambiar-estado/`). No hay esquema que cambiar ni carpetas que crear.

**Checkpoint**: US1 puede empezar directamente.

---

## Phase 3: User Story 1 - Abrir una tarea de la lista y volver (Priority: P1) 🎯 MVP

**Goal**: Cualquier miembro con sesión abre cualquier tarea (propia o ajena) desde el título de su fila, ve en `/tasks/:id` su título completo, responsable, estado y fecha de creación, y vuelve a la lista con el foco en la tarea que abrió; todo con ratón o solo con teclado, sin modificar nada y sin ningún control de edición. Sin sesión no se ve nada (FR-001 a FR-008, FR-012 a FR-014).

**Independent Test**: `npm test` en `backend/` con `show_task.spec.ts` en verde (matriz filas 1-11 de `contracts/task-detail-api.md`); y en la app, abrir una tarea propia y una de Ana desde su título, comprobar título, «Responsable», «Estado» y «Creada el», recargar, volver a la lista y repetir solo con teclado (`quickstart.md` §1 y §2).

### Tests for User Story 1 (matriz = Definition of Done) ⚠️

> Escribir **todo** el fichero PRIMERO (T002-T006) y comprobar en T007 que falla en rojo antes de implementar T008-T011. Todas las aserciones de cuerpo son `assert.deepEqual(response.body(), …)` sobre el cuerpo **entero** (research.md §6); nada de `assertBodyContains`. `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` no se editan.

- [X] T002 [US1] [Backend · test] Crear `backend/tests/functional/tasks/show_task.spec.ts` con `test.group('Tasks show (GET /api/v1/tasks/:id)')`, `group.each.setup(() => testUtils.db().truncate())` y los helpers locales del fichero (research.md §6, mismo estilo que `update_task_status.spec.ts`, sin extraerlos a `tests/`): `createOscar()` y `createAna()` (`User.create`), `createTask({ title, status, assigneeId })` (`Task.create`), `fetchCreatedAt(client, user, id)` que toma `createdAt` de la fila de esa tarea en `GET /api/v1/tasks` (no serializado a mano), un constructor del cuerpo esperado `{ data: { id, title, status, assignee: { id, fullName, initials }, createdAt } }`, y `snapshot(id)` que relee la tarea con `Task.findOrFail` y devuelve `status`, `title`, `assigneeId` y `updatedAt` (como ISO o millis) para las comprobaciones de «BD intacta» (research.md §5)
- [X] T003 [US1] [Backend · test] En `backend/tests/functional/tasks/show_task.spec.ts`, matriz filas **1-3** (camino feliz), todas con `.loginAs(oscar)`: (1) tarea de Oscar en `pending` → `GET /api/v1/tasks/:id` → `200`, cuerpo completo y BD intacta (`snapshot` antes = después, incluido `updatedAt`); (2) tres tareas de Oscar, se pide la del medio → `200`, cuerpo completo con el `id` y el `title` de esa y no de otra; (3) tarea de Ana en `in_progress` → `200`, cuerpo completo con `assignee` = Ana, sin campos extra, y BD intacta — depende de T002
- [X] T004 [US1] [Backend · test] En el mismo fichero, filas **4-6**: (4) tarea de Ana; Oscar pide `GET /api/v1/tasks` y `GET /api/v1/tasks/:id` y `assert.deepEqual` de `data` del detalle contra la fila de esa tarea en la lista (SC-002); (5) tarea en `done` → `200`, cuerpo completo con `status: 'done'`; (6) tarea con título de **200 caracteres** (`'a'.repeat(200)` o similar; es el máximo de `createTaskValidator`) → `200`, cuerpo completo con el título entero — depende de T003
- [X] T005 [US1] [Backend · test] En el mismo fichero, filas **7-8** (`401`), ambas sobre una tarea de Oscar y con cuerpo exacto `{ errors: [{ message: 'Unauthorized access' }] }` (lo que prueba que no viaja ningún dato de la tarea, FR-008/SC-007): (7) `GET` **sin** `loginAs` → `401` y BD intacta; (8) `GET` con `.header('Authorization', 'Bearer oat_no-es-un-token')` → `401` — depende de T004
- [X] T006 [US1] [Backend · test] En el mismo fichero, filas **9-11** (`404`), todas con `.loginAs(oscar)` y cuerpo exacto `{ errors: [{ message: 'Row not found' }] }`: (9) `GET /api/v1/tasks/999999` con BD sin esa tarea; (10) crear una tarea, `task.delete()`, pedir su id; (11) `GET /api/v1/tasks/abc`. No hay caso `422` (contracts/task-detail-api.md: «No aplica») — depende de T005
- [X] T007 [US1] [Backend · verificación] Desde `backend/`, `node ace test functional --files=show_task` y confirmar que **falla en rojo** por la razón correcta: la ruta aún no existe, así que los `200` y los `401` reciben un `404` de ruta inexistente y los `404` fallan en el cuerpo (volcado de depuración en lugar de `{ errors: [...] }`); un fallo por error de sintaxis, de import o de tipos del `apiClient` no cuenta como rojo válido. `create_task`, `list_tasks` y `update_task_status` siguen en verde — depende de T006

### Implementation for User Story 1 — backend

- [X] T008 [US1] [Backend · transformer] Crear `backend/app/transformers/task_detail_transformer.ts` con `export default class TaskDetailTransformer extends BaseTransformer<Task>` y un `toObject()` que devuelve `...this.pick(this.resource, ['id', 'title', 'status', 'createdAt'])` y `assignee: this.pick(this.resource.assignee, ['id', 'fullName', 'initials'])`. **No** hereda de `TaskTransformer` ni lo importa, y `task_transformer.ts` no se toca (research.md §2) — depende de T007
- [X] T009 [US1] [Backend · controlador] En `backend/app/controllers/tasks_controller.ts`, añadir `async show({ params, serialize }: HttpContext)`: `const task = await Task.findOrFail(params.id)`, `await task.load('assignee')`, `return serialize(TaskDetailTransformer.transform(task))` con `200`, importando `#transformers/task_detail_transformer`. Sin `save()`, `merge()` ni ninguna escritura (research.md §5); sin `try/catch`: el `404` lo da la rama `E_ROW_NOT_FOUND` ya existente en `app/exceptions/handler.ts` (research.md §3). `index` y `store` quedan igual — depende de T008
- [X] T010 [US1] [Backend · rutas] En `backend/start/routes.ts`, dentro del grupo `tasks` existente (el de `.prefix('tasks').as('tasks').use(middleware.auth())`), añadir `router.get(':id', [controllers.Tasks, 'show'])`, **sin** matcher numérico (research.md §4). `GET /`, `POST /` y `PATCH :id/status` del grupo, y el resto de rutas, quedan tal cual — depende de T009
- [X] T011 [US1] [Backend · generado] Desde `backend/`, arrancar `npm run dev` unos segundos (el hook `init` del assembler es el que escribe el registro Tuyau; `npm test` solo regenera `server/controllers.ts`, ver notas de `specs/002-cambiar-estado/tasks.md` → T013) y pararlo, para regenerar `backend/.adonisjs/client/registry/` (ruta `tasks.show`), `backend/.adonisjs/server/routes.d.ts` y `backend/.adonisjs/client/data.d.ts` (`Data.TaskDetail`). `backend/.adonisjs/server/controllers.ts` no debería cambiar (`Tasks` ya existe). No editarlos a mano; dejar el diff listo para commitear (research.md §13) — depende de T010
- [X] T012 [US1] [Backend · verificación] Desde `backend/`, `node ace test functional --files=show_task` → las 11 filas de la matriz en **verde** sin haber editado ni una aserción de T002-T006; `node ace list:routes` muestra `GET /api/v1/tasks/:id` (`tasks.show`) con middleware `auth` y las rutas previas igual que antes; `npm run typecheck` y `npm run lint` limpios — depende de T011

  - **Nota (T011-T012, decidido al implementar)**: el nombre real que AdonisJS da a la ruta es `tasks.tasks.show` (grupo `tasks` + nombre automático `tasks.show`), el mismo patrón que las existentes `tasks.tasks.index` / `tasks.tasks.store`; donde `plan.md`/`research.md` dicen `tasks.show` debe leerse así. No cambia nada del contrato. `npm run dev` regeneró `client/data.d.ts`, `client/registry/{index.ts,schema.d.ts,tree.d.ts}` y `server/routes.d.ts`; `server/controllers.ts` sin cambios. Al pasar `npm run lint` se corrigieron dos avisos de estilo en `show_task.spec.ts` (Prettier y `unicorn/no-await-expression-member` en el helper `fetchCreatedAt`), sin tocar ninguna aserción.

### Implementation for User Story 1 — frontend

- [X] T013 [P] [US1] [Frontend · lib] Crear `frontend/src/lib/task-status.ts` con `export const STATUS_LABELS: Record<TaskStatus, string> = { pending: 'Pendiente', in_progress: 'En curso', done: 'Hecho' }` (importando `TaskStatus` de `@/lib/types`), **movido tal cual** desde `frontend/src/components/tasks/task-status-select.tsx`; en ese componente, borrar la constante local e importarla de `@/lib/task-status`, sin ningún otro cambio de comportamiento (plan.md → Re-check post-Phase 1, punto 1) — puede empezar en paralelo con T002-T012
- [X] T014 [P] [US1] [Frontend · API] En `frontend/src/lib/api.ts`, añadir `export function getTask(id: string, token: string): Promise<Task>` → `GET /api/v1/tasks/${encodeURIComponent(id)}` con el token, desenvolviendo `data`, con el mismo helper `request` que usa `listTasks()`; `id` no se valida en el cliente. Los errores (`401`, sin conexión, `5xx`) pasan tal cual con los mensajes que ya genera `toApiError`/`request`; la traducción del `404` llega en T020 (US2). Corregir el comentario de `updateTaskStatus()` «Solo este endpoint responde 404, y siempre es porque la tarea ya no existe.» para que deje de afirmar que es el único endpoint con `404` (research.md §10) — puede empezar en paralelo con T002-T012 y con T013 una vez fijado el contrato; se verifica contra el backend de T012
- [X] T015 [US1] [Frontend · página] Crear `frontend/src/pages/task-page.tsx` (`TaskPage`): `id` de `useParams()`, `token` de `useAuth()` (solo lectura del hook, `frontend/src/auth/` no se toca); estado con los cuatro tipos `loading` / `loaded` / `not-found` / `error` (research.md §7), cargando con `getTask(id, token)` en un `useEffect` dependiente de `[id, token]` que resetea a `loading` al cambiar de `id` y marca la petición como obsoleta en el *cleanup*, de modo que una respuesta tardía de otro `id` nunca se pinta. `loading` → `FullScreenLoader`. `loaded` → mismo marco que `tasks-page.tsx` (`bg-muted/40 min-h-svh p-6` → `mx-auto flex max-w-2xl flex-col gap-6`), **primero en el DOM** el enlace «Volver a la lista» (`Button variant="link" asChild` envolviendo `<Link to="/tasks" state={{ focusTaskId: task.id }}>` con `ArrowLeftIcon` de `lucide-react`), y debajo un `Card` con el título en `<h1>` (`text-2xl font-semibold wrap-break-word`, **sin** `truncate`) y un `<dl>` como el de `profile-page.tsx` con «Responsable» (`task.assignee.fullName ?? 'Sin nombre'`), «Estado» (`STATUS_LABELS[task.status]` de `@/lib/task-status`) y «Creada el» (`new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(task.createdAt))`). **Ningún** control para cambiar el estado, editar, reasignar ni borrar (FR-006). Los estados `not-found` y `error` se pintan en US2 (T021, T022); hasta entonces no muestran ningún dato de tarea (research.md §11-§12, contracts/task-detail-ui.md → La página: estados) — depende de T013, T014
- [X] T016 [US1] [Frontend · rutas] En `frontend/src/routes/app-routes.tsx`, añadir `<Route path="/tasks/:id" element={<TaskPage />} />` **dentro** del `<Route element={<ProtectedRoute />}>` existente, junto a `/tasks`. `protected-route.tsx`, `public-only-route.tsx` y el comodín `*` no cambian (research.md §7, §14) — depende de T015
- [X] T017 [US1] [Frontend · componente] En `frontend/src/components/tasks/task-list.tsx`, sustituir el `<span>` del título de cada fila por `<Link to={`/tasks/${task.id}`} id={`task-${task.id}-link`}>` de react-router con las mismas clases (`min-w-0 truncate font-medium`) más `hover:underline underline-offset-4 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50`. Solo el título es enlace: el responsable y `<TaskStatusSelect>` siguen en la fila, **fuera** del enlace (FR-013), y la tarjeta no es clicable (research.md §8) — depende de T016
- [X] T018 [US1] [Frontend · página] En `frontend/src/pages/tasks-page.tsx`, leer `useLocation().state?.focusTaskId` y, en un efecto que corre cuando `isLoading` pasa a `false`, hacer `document.getElementById(`task-${focusTaskId}-link`)?.focus()` (mismo patrón que el `getElementById('title')?.focus()` ya existente); si la tarea ya no está en la lista, no se enfoca nada. El resto de la página (carga, `TaskForm`, `handleUpdated`) no cambia (research.md §9, FR-004) — depende de T017
- [X] T019 [US1] [Frontend · verificación] Desde `frontend/`, `npm run build` (typecheck) y `npm run lint` (oxlint) limpios; con backend y frontend en `npm run dev`, validar a mano `quickstart.md` §1 (abrir en 1 clic, datos coinciden con la fila, sin controles de edición, recargar mantiene la tarea, volver en 1 clic, tarea de Ana sin aviso, «Hecho» y título largo, cambiar el estado desde la fila no abre la tarea, `updatedAt` sin cambios en `node ace repl`) y §2 (solo teclado: `Tab` hasta el enlace, `Enter`, primer `Tab` en «Volver a la lista», `Enter`, foco de vuelta en el enlace de la tarea abierta) y, de §3, las filas «Sin sesión» y «API directa» — depende de T018, T012

  - **Nota (T015, decidido al implementar)**: el «reset a `loading` al cambiar de `id`» se implementa derivándolo, no con un `setState` síncrono dentro del efecto: cada resultado guarda la `key` (`id` + intento) de la petición que lo produjo, y si no coincide con la actual la página pinta `FullScreenLoader`. Mismo efecto observable (nunca se pinta otra tarea ni un resultado viejo), sin render intermedio. El *cleanup* marca la petición como obsoleta, como pide research.md §7.
  - **Nota (T019, decidido al implementar)**: la validación «a mano» de `quickstart.md` §1, §2 y las filas «Sin sesión»/«API directa» de §3 se hizo con un script de Playwright contra Chrome headless, con backend y frontend en `npm run dev`, instalado en un directorio temporal **fuera del repo** (`/tmp/flowsync-e2e`, sin tocar ningún `package.json`): 21/21 comprobaciones OK, incluidas el foco de vuelta en `#task-<id>-link`, el primer `Tab` en «Volver a la lista» y `updated_at` intacto leído de SQLite. No sustituye a la revisión humana del aspecto visual. **Formato de fecha**: la llamada es exactamente la de research.md §12 (`dateStyle: 'long', timeStyle: 'short'`), pero Chrome con ICU reciente la pinta «29 de septiembre de 2026 **a las** 22:07», no «…, 22:07» como el ejemplo del contrato; se deja así (el separador lo decide el motor de `Intl`, no el código) y el ejemplo del contrato debe leerse como ilustrativo.

**Checkpoint**: MVP. El endpoint cumple la matriz completa y desde la lista se abre cualquier tarea y se vuelve a ella, con teclado y sin cambiar nada. Aún no se dice «ya no existe» ni «no se ha podido cargar» en la vista (eso es US2).

---

## Phase 4: User Story 2 - La tarea que ya no existe (Priority: P2)

**Goal**: Si la tarea no existe (borrada, nunca existió o id no numérico) la vista dice en castellano que ya no existe y ofrece volver a la lista; si no se puede cargar por otra causa (sesión, conexión, servidor) lo explica sin afirmar que no existe; en ningún caso se pinta una vista vacía, parcial o de otra tarea (FR-009 a FR-011).

**Independent Test**: Con US1 hecha, `quickstart.md` §3: tarea borrada con la lista abierta, `/tasks/999999` y `/tasks/abc` → aviso «Esta tarea ya no existe» con «Volver a la lista» como primer `Tab`; backend parado → «No se ha podido cargar la tarea» + «Reintentar» que, con el backend de nuevo arriba, muestra la tarea; sesión revocada sin recargar → mensaje de sesión caducada sin «Reintentar»; en ningún caso aparece un dato de tarea.

> Sin tests automáticos de frontend: no hay runner (plan.md → Testing) y no se instala ninguno (BOUNDARIES.md: sin dependencias nuevas). El lado servidor del `404` ya está cubierto por las filas 9-11 de la matriz (US1).

### Implementation for User Story 2

- [X] T020 [US2] [Frontend · API] En `frontend/src/lib/api.ts`, dentro de `getTask()` (no como rama genérica de `toApiError`), capturar el `ApiError` con `status === 404` y relanzarlo como `ApiError` con status `404` y el mensaje exacto «Puede que alguien la haya borrado.» (contracts/task-detail-ui.md → Mensajes), igual que hace `updateTaskStatus()` con su propio texto; el resto de errores sigue pasando tal cual (research.md §10) — depende de T019
- [X] T021 [US2] [Frontend · página] En `frontend/src/pages/task-page.tsx`, estado `not-found` (`ApiError.status === 404`): mismo marco y el mismo enlace «Volver a la lista» arriba y primero en el DOM, pero a `/tasks` **sin** `state`, y en lugar del `Card` un `Alert` (variante `default`) con `AlertTitle` «Esta tarea ya no existe» y `AlertDescription` con `error.message` («Puede que alguien la haya borrado.»). Ningún título, responsable, estado ni fecha (FR-009, FR-010) — depende de T020
- [X] T022 [US2] [Frontend · página] En `frontend/src/pages/task-page.tsx`, estado `error` (cualquier otro `ApiError`): mismo marco y enlace «Volver a la lista» arriba sin `state`, y un `Alert variant="destructive"` con `AlertTitle` «No se ha podido cargar la tarea», `AlertDescription` con `error.message` (los textos ya existentes de `401`, sin conexión y `5xx`) y un `Button` «Reintentar» **salvo** con `status === 401`; «Reintentar» vuelve a `loading` y repite `getTask`, con la misma guarda de obsolescencia de T015. Nunca dice que la tarea no existe (FR-011, contracts/task-detail-ui.md → La página: estados) — depende de T021
- [X] T023 [US2] [Frontend · verificación] Desde `frontend/`, `npm run build` y `npm run lint` limpios; validar a mano `quickstart.md` §3 completo (borrada tras cargar la lista vía `node ace repl`, `/tasks/999999`, `/tasks/abc`, backend parado + «Reintentar», sesión caducada con recarga, sesión revocada sin recargar, sin sesión, API directa) y el paso 4 de «Teclado» de `contracts/task-detail-ui.md` (primer `Tab` en el aviso alcanza «Volver a la lista»); repetir `quickstart.md` §1 paso 2 y §2 para confirmar que US1 sigue igual — depende de T022

  - **Nota (T023, decidido al implementar)**: `quickstart.md` §3 se validó con el mismo script de Playwright de T019 (fuera del repo), repitiendo antes §1 y §2 enteros: 39/39 OK. Dos casos se provocaron de forma equivalente a la descrita, para poder automatizarlos sin parar el backend a mitad del script: «Sin conexión» abortando en el navegador la petición a `/api/v1/tasks/:id` (el `fetch` falla igual que con el backend parado) y retirando el bloqueo antes de «Reintentar»; «Error de servidor» respondiendo un `500` con HTML. La tarea «borrada tras cargar la lista» se borró con `sqlite3` sobre `backend/tmp/db.sqlite3` en vez de `node ace repl` (mismo efecto: la fila desaparece). La «sesión revocada» se hizo con `POST /api/v1/account/logout` sobre un token propio de esa pestaña.

**Checkpoint**: US1 y US2 completas: abrir, mirar y volver, y la vista nunca aparenta una tarea que no existe ni confunde «no existe» con «no se ha podido cargar».

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Valla, suite completa, cobertura, formato y revisión adversarial antes de pedir revisión humana.

- [X] T024 [Cross-cutting · valla + verificación + revisión] Tarea de cierre, en este orden y **antes de pedir revisión humana o abrir el PR**:
  1. **Dejar intactos** `backend/app/validators/user.ts`, los middlewares de autenticación (`backend/app/middleware/auth_middleware.ts`, `backend/app/middleware/silent_auth_middleware.ts`) y `frontend/src/auth/`: `git diff <commit base de T001> -- backend/app/validators/user.ts backend/app/middleware/auth_middleware.ts backend/app/middleware/silent_auth_middleware.ts frontend/src/auth/` debe salir **vacío** (no hay rama local `main`; la base es el commit anotado en T001). Comprobar también que el diff no toca el resto de BOUNDARIES.md (`backend/app/controllers/new_account_controller.ts`, `access_tokens_controller.ts`, `profile_controller.ts`, `backend/app/models/user.ts`, migraciones de `users`/`access_tokens`), ni `backend/database/`, `backend/app/models/task.ts`, `backend/app/transformers/task_transformer.ts`, `backend/app/exceptions/handler.ts`, `frontend/src/routes/protected-route.tsx`, `frontend/src/lib/types.ts`, `backend/package.json`/`package-lock.json`, `frontend/package.json`/`package-lock.json`, ni `backend/tests/functional/tasks/{create_task,list_tasks,update_task_status}.spec.ts`.
  2. Desde `backend/`: `npm test` → suite completa en verde (`create_task`, `list_tasks`, `update_task_status`, `show_task`).
  3. Desde `backend/`: `npm run test:coverage` → el porcentaje de líneas de `backend/app/` no baja del suelo anotado en T001.
  4. Desde `frontend/`: `npm run format` (Prettier) y confirmar que no deja cambios sin revisar en `frontend/src/`.
  5. Lanzar el subagente `adversarial-reviewer` sobre el diff completo de la rama (incluido `backend/.adonisjs/` regenerado) contra `specs/003-abrir-tarea/spec.md`, `specs/003-abrir-tarea/plan.md`, `specs/003-abrir-tarea/contracts/`, `BOUNDARIES.md` y `.specify/memory/constitution.md`; resolver cada hallazgo confirmado sin editar aserciones existentes para que pasen, y volver a correr los pasos 1-4 si hubo cambios.

  — depende de T023

  - **Resultado (T024)**: (1) `git diff e861fdd` vacío sobre la valla de auth y sobre el resto de la lista; (2) `npm test` → **41/41** en verde (30 previos + 11 de `show_task`); (3) `npm run test:coverage` → **Lines 69.93% (228/326)**, por encima del suelo de 67.65%; (4) `npm run format` en `frontend/` sin cambios (`prettier --check src` limpio); (5) `adversarial-reviewer` → **APPROVE-WITH-NOTES**, sin violaciones de la valla ni desviaciones bloqueantes. No hubo cambios de código tras la revisión, así que los pasos 1-4 no se repitieron.
  - **Nota (T024, decidido con research.md §4 delante)**: el revisor señaló (menor) que, sin matcher, SQLite convierte a entero ids no canónicos como `01`, `+1`, ` 1`, `1.0` o `1e0`, así que `GET /api/v1/tasks/01` devuelve la tarea 1 en vez de `404`. Se deja así: es consecuencia directa de la decisión «sin matcher» de research.md §4. No filtra datos ni se salta la autenticación, la interfaz solo genera ids canónicos, y un matcher `\d+` daría `E_ROUTE_NOT_FOUND` con el cuerpo Youch, cuyo arreglo pide tocar el handler de forma global (fuera de alcance). La fila 11 sigue cubriendo el caso del contrato (`abc` → `404`). El resto de notas del revisor (usar `load` en vez de `preload`, como pide T009; el `focusTaskId` que sobrevive a un F5 en `/tasks`, que no hace daño; y un `RangeError` ante una fecha inválida, que hoy no puede darse) no piden cambios.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; fija la línea base de suite, cobertura y commit base.
- **Foundational (Phase 2)**: vacía; no bloquea nada.
- **User Story 1 (Phase 3)**: depende de T001. Dentro: tests (T002-T006, mismo fichero, secuenciales) → rojo (T007) → transformer (T008) → controlador (T009) → ruta (T010) → regeneración (T011) → verde (T012); en paralelo, `lib/task-status.ts` (T013) y `getTask()` (T014) → página (T015) → ruta de frontend (T016) → enlace en la fila (T017) → foco al volver (T018) → verificación (T019, que exige también T012).
- **User Story 2 (Phase 4)**: depende de US1 completa (T019): amplía el mismo `getTask()` de T014 y los estados de `task-page.tsx` que declara T015.
- **Polish (Phase 5)**: depende de US1 y US2.

### User Story Dependencies

- **US1 (P1)**: independiente; entrega sola el MVP, incluida la matriz completa del endpoint (el `404` de servidor es parte de la DoD de US1).
- **US2 (P2)**: construye sobre la página de US1 (spec: «Depende de que exista la User Story 1, pero se puede verificar por separado»).

### Dentro de cada historia

- Matriz escrita entera y en rojo antes de la implementación (T002-T007 antes de T008-T011). No se edita ninguna aserción para que pase.
- Transformer antes que el controlador; controlador antes que la ruta; ruta antes que regenerar `.adonisjs/`.
- Backend en verde (T012) antes de dar por verificado el frontend (T019); `lib/` → página → ruta → fila → foco al volver.

### Parallel Opportunities

- T013 (`frontend/src/lib/task-status.ts` + `task-status-select.tsx`) y T014 (`frontend/src/lib/api.ts`): archivos distintos entre sí y respecto al backend, así que pueden hacerse mientras se escribe la matriz y se implementa el endpoint (T002-T012); el contrato (`contracts/task-detail-api.md`) ya fija forma y códigos.
- T002-T006 **no** son paralelizables: comparten `show_task.spec.ts`.
- T008-T011 son una cadena (transformer → controlador → ruta → generado).
- T015-T018 son secuenciales (la ruta necesita la página; el foco necesita el `id` del enlace). T021-T022 tocan el mismo `task-page.tsx`.

---

## Parallel Example: User Story 1

```bash
# Mientras se escribe la matriz (T002-T007) y se implementa el endpoint (T008-T012), en paralelo:
Task: "T013 Mover STATUS_LABELS a frontend/src/lib/task-status.ts e importarlo en task-status-select.tsx"
Task: "T014 Añadir getTask(id, token) y corregir el comentario de updateTaskStatus() en frontend/src/lib/api.ts"
```

## Parallel Example: User Story 2

```bash
# Sin paralelismo real: T020 → T021 → T022 es una cadena (api.ts y el mismo task-page.tsx).
# Mientras tanto se puede preparar el escenario de quickstart.md §3 (segunda pestaña con sesión,
# tarea a borrar vía node ace repl) para T023.
```

---

## Implementation Strategy

### MVP First (User Story 1 solamente)

1. Phase 1: línea base (T001).
2. Phase 3: matriz en rojo → endpoint en verde → página, ruta, enlace y foco (T002-T019).
3. **Parar y validar**: `show_task.spec.ts` en verde y `quickstart.md` §1-§2 de punta a punta.
4. Valor demostrable: «abro cualquier tarea desde la lista, la veo entera y vuelvo donde estaba, también con teclado».

### Incremental Delivery

1. Setup → base medida.
2. + US1 → demo: abrir y volver (MVP).
3. + US2 → demo: la vista nunca finge una tarea que no está.
4. Phase 5 → valla intacta, `npm test` + `npm run test:coverage`, `npm run format`, `adversarial-reviewer` → revisión humana.

---

## Notes

- Una historia (E2-5), un PR (Principio V): 1 ruta, 1 acción, 1 transformer, 1 fichero de tests, 1 función de API, 1 constante movida, 1 página, 1 ruta de frontend, 1 enlace por fila y la vuelta del foco.
- `backend/.adonisjs/` regenerado se commitea en el mismo PR (T011).
- Los textos de la vista y los avisos son exactos (contracts/task-detail-ui.md → Mensajes); no se reformulan.
- Fuera de alcance (no se construye): fecha de vencimiento y señal de vencida (FS-118), editar el título (E2-6), reasignar (E2-7), borrar (E2-10), cambiar el estado desde la vista, volver a la tarea tras iniciar sesión, lista viva (E3).
