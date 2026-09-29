# Implementation Plan: Cambiar el estado de una tarea desde la lista

**Branch**: `feat/e2-4-cambiar-estado` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cambiar-estado/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Permitir a cualquier miembro con sesión iniciada cambiar el estado de cualquier tarea del espacio compartido desde su propia fila de la lista, entre los tres estados fijos y en cualquier sentido (FR-001 a FR-010), viendo el resultado al instante y sin que la fila llegue nunca a mostrar como guardado un estado que no se guardó (FR-011 a FR-015). Enfoque técnico: un endpoint nuevo `PATCH /api/v1/tasks/:id/status` con cuerpo `{ status }`, en un controlador propio (`TaskStatusesController.update`) colgado del grupo `tasks` ya protegido por `middleware.auth()`; validador VineJS con `vine.enum(TASK_STATUSES)`; `Task.findOrFail` para el `404`; respuesta `200` con el `TaskTransformer` existente dentro de `serialize()`. En el frontend, cada fila de `task-list.tsx` muestra un `<select>` nativo con las clases de `ui/input.tsx` que llama a `updateTaskStatus()` en `lib/api.ts` y sustituye la fila por la tarea devuelta. **No hay cambio de esquema**, ni dependencias nuevas, ni se toca la zona vallada.

## Technical Context

**Language/Version**: TypeScript 6 (backend y frontend), Node.js (versión ya fijada por el repo; sin cambios)

**Primary Dependencies**: Backend: AdonisJS 7 (`@adonisjs/core` ^7.3), Lucid 22, VineJS 4.4, Auth 10 (ya instalados). Frontend: React 19, Vite 8, shadcn/ui sobre Tailwind v4 (ya instalados). Ninguna dependencia nueva (R-3, BOUNDARIES.md).

**Storage**: SQLite vía Lucid, tabla `tasks` existente (`1790152501403_create_tasks_table.ts`). Sin migración: `status` ya es `string NOT NULL` y el modelo ya lo tipa como `TaskStatus` (ver [data-model.md](./data-model.md)).

**Testing**: Backend: Japa, suite `functional`, fichero nuevo `backend/tests/functional/tasks/update_task_status.spec.ts` junto a los dos ya existentes, aislado con `testUtils.db().truncate()`. Cobertura con `npm run test:coverage` (c8, ya aprobado). Frontend: sin runner (fuera de alcance); verificación manual vía [quickstart.md](./quickstart.md).

**Target Platform**: Aplicación web (backend HTTP en `localhost:3333`, SPA en `localhost:5173`; CORS ya admite `PATCH` en `config/cors.ts`).

**Project Type**: Web application (backend + frontend, monorepo sin workspaces).

**Performance Goals**: El nuevo estado se ve en la fila de quien lo cambió en <1 s sin recargar (SC-002); una única escritura por cambio, sin recargar la lista entera.

**Constraints**: Sin dependencias nuevas; sin tocar esquema ni `database/schema.ts`; rutas existentes sin cambios (path, verbo y forma de respuesta); zona vallada de auth intacta; estilo visual existente (sin componente `Select` en `ui/`: `<select>` nativo con las clases de `ui/input.tsx`); operable entero con teclado (FR-015).

**Scale/Scope**: Espacio único compartido, equipo de 3-10 personas; sin paginación. Concurrencia: último en guardarse gana, sin bloqueo (Assumptions de la spec).

Ningún punto queda en NEEDS CLARIFICATION: los que la spec delegaba al plan (forma del control, textos de los mensajes, 404 determinista, orden de validación, cambios rápidos seguidos) se resuelven en [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` **v1.1.0**.

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` no nombra rutas, códigos de estado, tablas ni componentes (solo «rechaza», «avisa», «no existe»); el endpoint, el `422`/`404`/`401` y el `<select>` aparecen solo aquí y en los artefactos de diseño. |
| II. Los tests son la spec ejecutable (**matriz = DoD**) | ✅ `update_task_status.spec.ts` se escribe **antes** que el controlador, el validador y la ruta, y debe fallar en rojo primero. Cubre la **matriz completa** del endpoint, asertada contra la forma completa del cuerpo (no solo el código): camino feliz para las **6 transiciones** (incluidas las 2 que salen de `done`) más el mismo estado, sobre tarea propia y ajena; `422` (valor fuera del catálogo, etiqueta en castellano, vacío, ausente); `401` sin sesión; `404` con id inexistente, tarea borrada e id no numérico. Cada caso de error comprueba además que la fila en BD no cambió. Detalle en [contracts/task-status-api.md](./contracts/task-status-api.md#matriz-de-comportamiento-definition-of-done). La cobertura de `backend/app/` no baja: todo el código nuevo (controlador, validador, rama del handler) queda ejercitado por la matriz. Las suites existentes (`create_task`, `list_tasks`) siguen en verde sin editarse. |
| III. La valla manda | ✅ Ningún archivo de BOUNDARIES.md se toca (ni `frontend/src/auth/`, ni middlewares, ni `user.ts`). La ruta nueva va **dentro** del grupo `tasks` con `middleware.auth()`; `GET`/`POST /api/v1/tasks` y el resto no cambian. Sin migración, `database/schema.ts` no se regenera ni se edita. Sin dependencias. El único fichero backend fuera de `tasks` que se toca es `app/exceptions/handler.ts` (no vallado), y solo para `E_ROW_NOT_FOUND`, que hoy no lanza ninguna ruta existente — ver [research.md §3](./research.md#3-forma-determinista-del-404). |
| IV. Convenciones del repo | ✅ Comandos desde `backend/`/`frontend/`; controlador vía `#generated/controllers`; respuesta por `serialize()` + `TaskTransformer`; validador `vine.create` en `app/validators/task.ts`; llamada nueva solo en `lib/api.ts`; control con las clases de `ui/input.tsx` y mensaje con `FieldError`, sin rediseño; Prettier por el hook. `.adonisjs/` regenerado y commiteado. |
| V. Cambios pequeños, revisables y con su spec | ✅ Una historia (E2-4), un PR: 1 endpoint, 1 controlador, 1 validador, 1 rama de handler, 1 fichero de tests, 1 función de API, 1 componente de fila. Vive en `specs/002-cambiar-estado/` con spec + plan + tasks. |

**Resultado (pre-Phase 0)**: PASS. Sin violaciones que justificar.

**Re-check post-Phase 1**: PASS. El diseño añade una sola pieza no pedida explícitamente en el input —la rama de `E_ROW_NOT_FOUND` en `app/exceptions/handler.ts`— y es precisamente la que hace cumplible el Principio II: sin ella el cuerpo del `404` en dev/test es un volcado de Youch con la traza, que no se puede asertar como forma completa. No altera ninguna ruta existente (ninguna usa `findOrFail`/`firstOrFail` hoy; comprobado con `grep` en `app/` y `start/`).

## Project Structure

### Documentation (this feature)

```text
specs/002-cambiar-estado/
├── spec.md              # /speckit-specify
├── checklists/          # /speckit-specify
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── task-status-api.md
│   └── task-status-ui.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── controllers/
│   │   └── task_statuses_controller.ts      # nuevo (update)
│   ├── validators/
│   │   └── task.ts                          # + updateTaskStatusValidator (vine.enum(TASK_STATUSES))
│   ├── exceptions/
│   │   └── handler.ts                       # + E_ROW_NOT_FOUND → 404 { errors: [{ message }] }
│   ├── models/task.ts                       # sin cambios (ya exporta TASK_STATUSES)
│   └── transformers/task_transformer.ts     # sin cambios
├── start/
│   └── routes.ts                            # + router.patch(':id/status', ...) dentro del grupo tasks
├── .adonisjs/
│   ├── server/controllers.ts                # regenerado (TaskStatuses)
│   └── client/registry/                     # regenerado (tasks.task_statuses.update)
└── tests/functional/tasks/
    └── update_task_status.spec.ts           # nuevo, escrito ANTES que la implementación

frontend/src/
├── lib/
│   ├── api.ts                               # + updateTaskStatus(), 'PATCH', rama 404, regla 'enum', label 'status'
│   └── types.ts                             # sin cambios (TaskStatus ya existe)
├── components/tasks/
│   ├── task-list.tsx                        # cada fila renderiza TaskStatusSelect; recibe token + onTaskUpdated
│   └── task-status-select.tsx               # nuevo: <select> nativo + estado por fila + mensaje de error
└── pages/
    └── tasks-page.tsx                       # + handleUpdated: sustituye la tarea por id en el estado
```

**Structure Decision**: Layout web existente, `backend/` (AdonisJS, API) + `frontend/` (React SPA), sin carpetas nuevas en la raíz. El control por fila se extrae a `task-status-select.tsx` porque necesita estado propio (valor mostrado, petición en curso, error) y los hooks no pueden vivir dentro del `map` de `task-list.tsx`; `task-list.tsx` sigue siendo quien lo pinta en cada fila. Ver [research.md §6-§8](./research.md#6-control-de-estado-en-la-fila).

## Complexity Tracking

*No aplica: el Constitution Check no encontró violaciones.*
