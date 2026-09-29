# Data Model: Cambiar el estado de una tarea desde la lista

Solo lo que cambia respecto a [`specs/001-crear-tarea/data-model.md`](../001-crear-tarea/data-model.md). **Nada cambia en el esquema**: no hay migración, `database/schema.ts` no se regenera ni se edita, y `app/models/task.ts` queda igual.

## Esquema: sin cambios

| Pieza | Estado actual | Cambio en E2-4 |
|---|---|---|
| Tabla `tasks` (`1790152501403_create_tasks_table.ts`) | `status string NOT NULL default 'pending'`, `updated_at timestamp nullable` | Ninguno |
| `TaskSchema` (`database/schema.ts`, generado) | `status: string`, `updatedAt` con `autoCreate + autoUpdate` | Ninguno |
| Modelo `Task` (`app/models/task.ts`) | `TASK_STATUSES = ['pending', 'in_progress', 'done'] as const`, `declare status: TaskStatus`, `belongsTo assignee` | Ninguno; el validador nuevo importa `TASK_STATUSES` de aquí |
| `TaskTransformer` | `id`, `title`, `status`, `createdAt`, `assignee{id, fullName, initials}` | Ninguno; la respuesta del endpoint nuevo tiene exactamente esta forma |
| `frontend/src/lib/types.ts` | `TaskStatus`, `Task` | Ninguno |

## Qué cambia: el comportamiento del atributo `status`

Hasta E2-1, `status` solo se escribía al crear (siempre `pending`). Desde E2-4 se puede escribir después, con estas reglas:

| Regla | Origen |
|---|---|
| Solo acepta `pending`, `in_progress` o `done` (catálogo `TASK_STATUSES`, cerrado; no se puede crear, renombrar ni eliminar valores) | FR-005, FR-007, RF-8 |
| Cualquier valor fuera del catálogo se rechaza y la fila en BD no cambia | FR-008 |
| Es el **único** atributo que cambia: `title` y `assignee_id` se conservan aunque el cuerpo los traiga | FR-004 |
| Lo puede cambiar cualquier miembro autenticado, sea o no el responsable | FR-003, CA-2 |
| `updated_at` se actualiza solo (`autoUpdate`), no se expone | — |
| Concurrencia: gana la última escritura, sin control de versión | Assumptions de la spec |

## Transiciones de estado

Grafo completo: desde cualquier estado se puede ir a cualquier otro, y elegir el estado actual no es un error.

| Desde \ Hacia | `pending` | `in_progress` | `done` |
|---|---|---|---|
| `pending` | ✅ (sin efecto) | ✅ | ✅ salto directo |
| `in_progress` | ✅ vuelta atrás | ✅ (sin efecto) | ✅ |
| `done` | ✅ vuelta atrás | ✅ vuelta atrás | ✅ (sin efecto) |

Las 6 transiciones entre estados distintos son la parte «camino feliz» de la matriz de tests (SC-003); ver [contracts/task-status-api.md](./contracts/task-status-api.md#matriz-de-comportamiento-definition-of-done).
