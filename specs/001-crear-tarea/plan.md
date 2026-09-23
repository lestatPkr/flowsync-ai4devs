# Implementation Plan: Crear tarea con solo el título

**Branch**: `feat/e2-1-crear-tarea` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-crear-tarea/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Permitir a cualquier miembro con sesión iniciada crear una tarea escribiendo solo un título (FR-001 a FR-007), verla de inmediato en la lista del espacio compartido con su título, responsable y estado (FR-008, FR-009), y ver un estado vacío con llamada a la acción cuando el espacio no tiene ninguna tarea (FR-010). Enfoque técnico: un modelo `Task` nuevo con relación al `User` responsable, un endpoint `POST /api/v1/tasks` (crear) y `GET /api/v1/tasks` (listar) dentro de una ruta protegida por `middleware.auth()`, y una página de frontend con formulario de un solo campo + lista, reutilizando `lib/api.ts` y los componentes `ui/` existentes. Sin dependencias nuevas y sin tocar la zona vallada de autenticación.

## Technical Context

**Language/Version**: TypeScript (backend y frontend), Node.js (versión ya fijada por el repo; sin cambios)

**Primary Dependencies**: Backend: AdonisJS 7, Lucid 22, VineJS 4, Auth 10 (ya instalados). Frontend: React 19, Vite 8, react-router, shadcn/ui sobre Tailwind v4 (ya instalados). Ninguna dependencia nueva (BOUNDARIES.md).

**Storage**: SQLite vía Lucid, misma conexión que `users`/`auth_access_tokens` (`config/database.ts`, `app.tmpPath('db.sqlite3')`). Tabla nueva `tasks` creada por migración.

**Testing**: Backend: Japa, suite `functional` (`backend/tests/functional/**/*.spec.ts`) — carpeta a crear en este cambio. Frontend: sin runner instalado (fuera de alcance de este cambio); verificación manual vía `quickstart.md`.

**Target Platform**: Aplicación web (backend HTTP en `localhost:3333`, frontend SPA en `localhost:5173`).

**Project Type**: Web application (backend + frontend, monorepo sin workspaces).

**Performance Goals**: La tarea creada debe verse en la lista de quien la creó en <1s sin recargar (SC-003 de la spec); no hay objetivo de carga/concurrencia definido para este cambio (espacio de equipo pequeño, sin paginación exigida).

**Constraints**: Sin dependencias nuevas (BOUNDARIES.md); rutas públicas existentes sin cambios; `database/schema.ts` no se edita a mano; zona vallada de auth intacta; estilo visual existente (solo componentes ya presentes en `frontend/src/components/ui/`).

**Scale/Scope**: Espacio único compartido, equipo de 3-10 personas (contexto de producto del PRD); volumen de tareas bajo, sin necesidad de paginación en este alcance.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` no menciona tablas, rutas ni componentes; este `plan.md` es el único lugar donde aparecen. |
| II. Los tests son la spec ejecutable | ✅ La historia P1 (crear tarea) lleva tests funcionales Japa que se escriben antes que la implementación (ver `tasks.md` cuando se genere); `backend/tests/functional/` no existe y su creación se cuenta como parte de este cambio, tal como exige el principio. |
| III. La valla manda | ✅ No se toca ningún archivo de `BOUNDARIES.md`; el endpoint nuevo reutiliza `middleware.auth()` ya existente sin modificarlo; `database/schema.ts` se regenera con `node ace migration:run`, nunca se edita a mano; no se añade ninguna dependencia nueva. |
| IV. Convenciones del repo | ✅ AdonisJS + Lucid + SQLite en `backend/`, React + Vite en `frontend/`; comandos ejecutados desde cada carpeta; migración para el cambio de esquema; frontend reutiliza componentes `ui/` existentes sin rediseño. |
| V. Cambios pequeños, revisables y con su spec | ✅ Este cambio vive en `specs/001-crear-tarea/` con `spec.md` + `plan.md` (y a continuación `tasks.md`); cabe en un único PR revisable. |

**Resultado**: PASS. No hay violaciones que justificar en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-crear-tarea/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── tasks-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/
│   │   └── task.ts                      # nuevo
│   ├── controllers/
│   │   └── tasks_controller.ts          # nuevo (store, index)
│   ├── validators/
│   │   └── task.ts                      # nuevo (createTaskValidator)
│   └── transformers/
│       └── task_transformer.ts          # nuevo
├── database/
│   ├── migrations/
│   │   └── <timestamp>_create_tasks_table.ts   # nuevo
│   └── schema.ts                        # regenerado, no editado a mano
├── start/
│   └── routes.ts                        # se añade un grupo /api/v1/tasks protegido
├── .adonisjs/server/controllers.ts      # regenerado (registra TasksController)
└── tests/
    └── functional/
        └── tasks/
            └── create_task.spec.ts      # nuevo, escrito antes que la implementación

frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts                       # se añaden createTask()/listTasks()
│   │   └── types.ts                     # se añaden Task, CreateTaskPayload
│   ├── pages/
│   │   └── tasks-page.tsx               # nuevo: formulario + lista + estado vacío
│   ├── components/
│   │   └── tasks/
│   │       ├── task-form.tsx            # nuevo: formulario de un solo campo
│   │       ├── task-list.tsx            # nuevo: lista con título/responsable/estado
│   │       └── empty-tasks-state.tsx    # nuevo: estado vacío con CTA
│   └── routes/
│       └── app-routes.tsx               # se cambia el destino tras login a /tasks
```

**Structure Decision**: Se sigue el layout web existente (Opción 2 del template): `backend/` (AdonisJS, API) + `frontend/` (React SPA), sin paquetes nuevos ni carpetas de nivel raíz. La lista de tareas se convierte en la pantalla de destino tras iniciar sesión (sustituye a `/profile` como landing, mientras `/profile` se mantiene accesible); ver `research.md` para la decisión de navegación.

## Complexity Tracking

*No aplica: el Constitution Check no encontró violaciones.*
