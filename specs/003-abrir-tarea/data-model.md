# Data Model: Abrir una tarea de la lista

Solo lo que cambia respecto a [`specs/001-crear-tarea/data-model.md`](../001-crear-tarea/data-model.md) y [`specs/002-cambiar-estado/data-model.md`](../002-cambiar-estado/data-model.md). **Nada cambia en el esquema**: no hay migración, `database/schema.ts` no se regenera ni se edita, y `app/models/task.ts` queda igual. Este cambio **solo lee**.

## Esquema: sin cambios

| Pieza | Estado actual | Cambio en E2-5 |
|---|---|---|
| Tabla `tasks` | `id`, `title string NOT NULL`, `status string NOT NULL default 'pending'`, `assignee_id → users.id`, `created_at NOT NULL`, `updated_at nullable` | Ninguno |
| `TaskSchema` (`database/schema.ts`, generado) | Columnas de arriba, `createdAt`/`updatedAt` como `DateTime` | Ninguno |
| Modelo `Task` (`app/models/task.ts`) | `TASK_STATUSES`, `declare status: TaskStatus`, `belongsTo assignee` | Ninguno |
| `TaskTransformer` (lista) | `id`, `title`, `status`, `createdAt`, `assignee{id, fullName, initials}` | **Ninguno**: la forma de `GET`/`POST /api/v1/tasks` y `PATCH :id/status` no cambia |
| `frontend/src/lib/types.ts` | `TaskStatus`, `Task` | Ninguno; `Task` describe también el detalle mientras coincidan |

## Qué se añade: la proyección de detalle

`TaskDetailTransformer` (`app/transformers/task_detail_transformer.ts`) es una **proyección de lectura** de `Task`, no una entidad nueva ni una tabla.

| Campo | Origen | Tipo en JSON | Nota |
|---|---|---|---|
| `id` | `tasks.id` | number | |
| `title` | `tasks.title` | string | Completo (hasta 200 caracteres por `createTaskValidator`); la vista no lo recorta |
| `status` | `tasks.status` | `"pending" \| "in_progress" \| "done"` | Valor interno; la etiqueta en castellano la pone el frontend (`STATUS_LABELS`) |
| `assignee.id` | `users.id` vía `assignee_id` | number | |
| `assignee.fullName` | `users.full_name` | string \| null | `null` → «Sin nombre», igual que en la lista |
| `assignee.initials` | getter de `User` | string | |
| `createdAt` | `tasks.created_at` | string ISO 8601 | El frontend lo formatea en castellano ([research.md §12](./research.md#12-formato-de-cuándo-se-creó)) |

Hoy los campos coinciden uno a uno con `TaskTransformer`. Se separan porque **FS-118** añadirá a esta proyección la fecha de vencimiento y la señal de vencida, que la lista no debe llevar (RF-15). Ver [research.md §2](./research.md#2-transformer-propio-del-detalle).

## Reglas de lectura

| Regla | Origen |
|---|---|
| Cualquier miembro autenticado lee cualquier tarea, sea o no su responsable; no hay filtro por propietario | FR-001, FR-007, R-4 |
| Sin sesión no se lee nada | FR-008 |
| Una tarea inexistente (borrada o que nunca existió, o un id no numérico) no produce ninguna proyección | FR-009, FR-010 |
| Leer no escribe: `status`, `title`, `assignee_id`, `created_at` y `updated_at` quedan como estaban | FR-005, SC-004 |
| Se devuelve lo guardado en el momento de la lectura; no hay suscripción a cambios | Assumptions (sin E3) |

## Transiciones de estado

Ninguna: la vista es de solo consulta (FR-006). Las transiciones siguen siendo las de E2-4, desde la fila de la lista.
