# Implementation Plan: Abrir una tarea de la lista

**Branch**: `feat/e2-5-abrir-tarea` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-abrir-tarea/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Permitir a cualquier miembro con sesión abrir cualquier tarea del espacio compartido desde su fila de la lista, ver en una vista propia su título completo, responsable, estado y fecha de creación, y volver a la lista, todo operable con teclado y sin modificar nada (FR-001 a FR-008, FR-012 a FR-014); y, si la tarea ya no existe o no se puede cargar, decirlo sin pintar nunca una vista vacía o a medias (FR-009 a FR-011). Enfoque técnico: un endpoint nuevo `GET /api/v1/tasks/:id`, acción `show` de `TasksController`, **dentro** del grupo `tasks` ya protegido por `middleware.auth()`; `Task.findOrFail` para el `404` (la rama de `E_ROW_NOT_FOUND` de `app/exceptions/handler.ts` ya existe desde E2-4); respuesta `200` a través de un transformer **propio** del detalle, `TaskDetailTransformer`, que hoy tiene la misma forma que `TaskTransformer` pero se separa ya porque FS-118 le añadirá campos que la lista no debe llevar. En el frontend, ruta protegida `/tasks/:id` con una página nueva `task-page.tsx`, el título de cada fila de `task-list.tsx` pasa a ser un `Link` de react-router (el `<select>` de estado se queda en la fila), y `getTask()` nueva en `lib/api.ts`. **No hay cambio de esquema**, ni dependencias nuevas, ni se toca la zona vallada.

## Technical Context

**Language/Version**: TypeScript 6 (backend y frontend), Node.js (versión ya fijada por el repo; sin cambios)

**Primary Dependencies**: Backend: AdonisJS 7 (`@adonisjs/core` ^7.3), Lucid 22, Auth 10 (ya instalados). Frontend: React 19, Vite 8, react-router 8.3 (`Link`, `useParams`, `useLocation`, en modo declarativo con `BrowserRouter`), shadcn/ui sobre Tailwind v4, `lucide-react` (ya instalados). Ninguna dependencia nueva (R-3, BOUNDARIES.md).

**Storage**: SQLite vía Lucid, tabla `tasks` existente. **Solo lectura**: sin migración, sin escrituras (ver [data-model.md](./data-model.md)).

**Testing**: Backend: Japa, suite `functional`, fichero nuevo `backend/tests/functional/tasks/show_task.spec.ts` junto a los tres existentes, aislado con `testUtils.db().truncate()`, escrito y ejecutado en **rojo** antes de la ruta, la acción y el transformer. Cobertura con `npm run test:coverage` (c8, ya aprobado). Frontend: sin runner (fuera de alcance); verificación manual vía [quickstart.md](./quickstart.md).

**Target Platform**: Aplicación web (backend HTTP en `localhost:3333`, SPA en `localhost:5173`; CORS ya admite `GET`).

**Project Type**: Web application (backend + frontend, monorepo sin workspaces).

**Performance Goals**: La vista de una tarea existente aparece en <1 s a la escala de RNF-5 (SC-003): una única lectura por id con `preload` del responsable, sin cargar la lista.

**Constraints**: Sin dependencias nuevas; sin tocar esquema ni `database/schema.ts`; rutas existentes sin cambios (path, verbo y forma de respuesta; `TaskTransformer` intacto); zona vallada de auth intacta (`ProtectedRoute` se reutiliza, `frontend/src/auth/` no se toca); estilo visual existente con los componentes de `frontend/src/components/ui/` (`Card`, `Alert`, `Button`); operable entero con teclado, incluida la vuelta con el foco en la tarea abierta (FR-004); vista de solo consulta (FR-006).

**Scale/Scope**: Espacio único compartido, equipo de 3-10 personas. Sin lista viva (E3): lo que se ve es lo guardado al cargar.

Ningún punto queda en NEEDS CLARIFICATION: los que la spec delegaba al plan (formato de «cuándo se creó», textos de los avisos, cómo se distingue «ya no existe» de «no se pudo cargar», cómo se recupera el foco al volver) se resuelven en [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` **v1.1.0**.

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` no nombra rutas, códigos de estado, transformers ni componentes («vista de una tarea», «ya no existe», «no se ha podido cargar»); `GET /tasks/:id`, el `401`/`404`, `TaskDetailTransformer` y `/tasks/:id` en el frontend aparecen solo aquí y en los artefactos de diseño. |
| II. Los tests son la spec ejecutable (**matriz = DoD**) | ✅ `show_task.spec.ts` se escribe **antes** que la ruta, la acción `show` y el transformer, y debe fallar en rojo primero. Cubre la **matriz del endpoint** asertada contra la forma completa del cuerpo (`assert.deepEqual` sobre `response.body()` entero): camino feliz (tarea propia, tarea ajena, la tarea pedida entre varias, tarea en `done`, título de 200 caracteres, el detalle coincide con la fila de `GET /tasks`, la BD queda intacta tras leer); `401` sin sesión y con un token que no es válido, sin ningún dato de la tarea en el cuerpo; `404` con id inexistente, tarea borrada e id no numérico. **`422` no aplica**: el endpoint no recibe cuerpo ni query, y `:id` no se valida con VineJS (el id inválido es un `404`, [research.md §4](./research.md#4-id-no-numérico-y-por-qué-no-hay-422)); la constitución exige la rama «cuando aplique». Detalle en [contracts/task-detail-api.md](./contracts/task-detail-api.md#matriz-de-comportamiento-definition-of-done). La cobertura de `backend/app/` no baja: la acción y el transformer nuevos quedan ejercitados por la matriz. Las suites existentes (`create_task`, `list_tasks`, `update_task_status`) siguen en verde sin editarse. |
| III. La valla manda | ✅ Ningún archivo de BOUNDARIES.md se toca (ni `frontend/src/auth/`, ni middlewares, ni `user.ts`, ni controladores de auth). La ruta nueva va **dentro** del grupo `tasks` con `middleware.auth()`; `GET`/`POST /api/v1/tasks`, `PATCH /api/v1/tasks/:id/status` y el resto no cambian (ni `TaskTransformer`, que sigue dando la forma de la lista). Sin migración, `database/schema.ts` no se regenera ni se edita. Sin dependencias. `app/exceptions/handler.ts` **no** se toca: su rama de `E_ROW_NOT_FOUND` ya da la forma del `404`. |
| IV. Convenciones del repo | ✅ Comandos desde `backend/`/`frontend/`; controlador vía `#generated/controllers`; respuesta por `serialize()` + transformer de `app/transformers/`; imports por subpath (`#transformers/task_detail_transformer`); llamada nueva solo en `lib/api.ts`, con el mensaje en castellano generado allí; página con `Card`/`Alert`/`Button` de `ui/` y el mismo marco que `tasks-page.tsx`, sin rediseño; Prettier por el hook. `.adonisjs/` regenerado y commiteado. |
| V. Cambios pequeños, revisables y con su spec | ✅ Una historia (E2-5), un PR: 1 ruta, 1 acción, 1 transformer, 1 fichero de tests, 1 función de API, 1 página, 1 ruta de frontend, 1 enlace por fila y la vuelta del foco en `tasks-page.tsx`. Vive en `specs/003-abrir-tarea/` con spec + plan + tasks. |

**Resultado (pre-Phase 0)**: PASS. Sin violaciones que justificar.

**Re-check post-Phase 1**: PASS. El diseño añade dos piezas no nombradas en el input, ambas sin cambio de comportamiento para lo existente y sin salir de la valla:

1. **`frontend/src/lib/task-status.ts`** (nuevo): traslada ahí el `STATUS_LABELS` que hoy vive dentro de `task-status-select.tsx`, para que la fila y la vista de la tarea usen las **mismas** etiquetas (SC-002: lo que ve la vista coincide con lo que mostraba la lista). Es un movimiento de una constante, sin cambio de comportamiento; no hay runner de frontend que lo caracterice, y el `quickstart.md` comprueba las etiquetas en ambos sitios. Dejarla en el `.tsx` y exportarla rompería `react/only-export-components` de oxlint; copiarla abriría la puerta a que diverjan.
2. **`frontend/src/pages/tasks-page.tsx`** (retoque): al volver de una tarea, pone el foco en el enlace de esa tarea en la lista (FR-004). Es la única forma de cumplir «al volver con el teclado, seguir recorriendo la lista desde la tarea que abrió», porque la lista se vuelve a montar al navegar ([research.md §9](./research.md#9-volver-a-la-lista-con-el-foco-en-la-tarea-abierta)).

Además se corrige un comentario ya falso en `updateTaskStatus()` («Solo este endpoint responde 404»). Ninguna ruta, forma de respuesta ni fichero vallado cambia.

## Project Structure

### Documentation (this feature)

```text
specs/003-abrir-tarea/
├── spec.md              # /speckit-specify
├── checklists/          # /speckit-specify
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── task-detail-api.md
│   └── task-detail-ui.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── controllers/
│   │   └── tasks_controller.ts              # + show (Task.findOrFail + load('assignee'))
│   ├── transformers/
│   │   ├── task_detail_transformer.ts       # nuevo: id, title, status, assignee{id, fullName, initials}, createdAt
│   │   └── task_transformer.ts              # sin cambios (sigue siendo el de la lista)
│   ├── exceptions/handler.ts                # sin cambios (E_ROW_NOT_FOUND → 404 ya existe)
│   └── models/task.ts                       # sin cambios
├── start/
│   └── routes.ts                            # + router.get(':id', [controllers.Tasks, 'show']) dentro del grupo tasks
├── .adonisjs/
│   ├── client/registry/                     # regenerado (tasks.show)
│   └── client/data.d.ts                     # regenerado (Data.TaskDetail)
└── tests/functional/tasks/
    └── show_task.spec.ts                    # nuevo, escrito ANTES que la implementación

frontend/src/
├── lib/
│   ├── api.ts                               # + getTask(id, token), 404 → mensaje de tarea inexistente; comentario de updateTaskStatus corregido
│   ├── task-status.ts                       # nuevo: STATUS_LABELS compartido (movido desde task-status-select.tsx)
│   └── types.ts                             # sin cambios (Task ya es la forma del detalle hoy)
├── routes/
│   └── app-routes.tsx                       # + <Route path="/tasks/:id" element={<TaskPage />} /> dentro de ProtectedRoute
├── pages/
│   ├── task-page.tsx                        # nuevo: carga, vista, «ya no existe», «no se ha podido cargar»
│   └── tasks-page.tsx                       # + foco en el enlace de la tarea de la que se vuelve
└── components/tasks/
    ├── task-list.tsx                        # el título de cada fila pasa a ser <Link to="/tasks/:id">
    └── task-status-select.tsx               # importa STATUS_LABELS de lib/task-status.ts (sin cambio de comportamiento)
```

**Structure Decision**: Layout web existente, `backend/` (AdonisJS, API) + `frontend/` (React SPA), sin carpetas nuevas. La acción `show` va en `TasksController` porque es la lectura del propio recurso `tasks` (el estado vivía aparte por ser sub-recurso, [research.md §1](./research.md#1-endpoint-y-acción)). La página nueva sigue la convención `pages/<nombre>-page.tsx`; el enlace se queda en `task-list.tsx`, que es quien pinta la fila.

## Complexity Tracking

*No aplica: el Constitution Check no encontró violaciones.*
