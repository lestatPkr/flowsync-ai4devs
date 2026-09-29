# Data Model: Fecha de vencimiento y tareas vencidas

Solo lo que cambia respecto a [`specs/001-crear-tarea/data-model.md`](../001-crear-tarea/data-model.md), [`specs/002-cambiar-estado/data-model.md`](../002-cambiar-estado/data-model.md) y [`specs/003-abrir-tarea/data-model.md`](../003-abrir-tarea/data-model.md). **Este cambio toca el esquema**: una columna nueva en `tasks`, por migración (Principio IV).

## Esquema: columna nueva `tasks.due_date`

| Columna | Tipo | Nulabilidad | Default | Índice |
|---|---|---|---|---|
| `due_date` | `date` (en SQLite se guarda como texto `'AAAA-MM-DD'`) | **NULL** permitido | **Ninguno** | Ninguno |

- **Migración**: `backend/database/migrations/<timestamp>_add_due_date_to_tasks.ts`, generada con `node ace make:migration add_due_date_to_tasks`. `up()`: `alterTable('tasks')` + `table.date('due_date').nullable()`. `down()`: `alterTable('tasks')` + `table.dropColumn('due_date')`. La migración de `create_tasks_table` no se toca; las de `users` y `access_tokens` (zona vallada) tampoco.
- **Tareas existentes**: tras `migration:run` todas quedan con `due_date = NULL`: sin fecha, válidas tal cual y no vencidas (FR-022). No hay backfill.
- **Por qué `date` y no `datetime`**: la fecha de vencimiento es **un día del calendario, no un instante**, y es el mismo día escrito para todos los que la miran (spec, Key Entities). Un `datetime` guardaría «el 30 a las 00:00» en algún huso, y quien mire desde otro vería escrito el 29 o el 1: la fecha cambiaría según quién mira, que es lo único que la spec dice que no puede cambiar. Con `date` no hay hora que convertir; lo único que varía entre personas es si ese día ya es anterior a **su** hoy (FR-012), y eso se decide al leer, no al guardar. Detalle en [research.md §1](./research.md#1-columna-date-nullable-sin-default).
- **Por qué nullable y sin default**: «sin fecha» es el estado normal y el camino por defecto al crear (FR-001, FR-002, CA-1). Un default sería sugerir una fecha.

## Código generado y modelo

| Pieza | Antes | Después |
|---|---|---|
| `TaskSchema` (`backend/database/schema.ts`, **generado** por `node ace migration:run`, no se edita a mano) | `assigneeId`, `createdAt`, `id`, `status`, `title`, `updatedAt` | + `@column.date() declare dueDate: DateTime \| null` (Lucid 22: `date` → `@column.date`, `DateTime` de Luxon; se persiste con `toISODate()` y se lee con `DateTime.fromSQL`) |
| Modelo `Task` (`backend/app/models/task.ts`) | `TASK_STATUSES`, `declare status: TaskStatus`, `belongsTo assignee` | Hereda `dueDate` de `TaskSchema` **sin redeclararlo**; + método `isOverdueOn(today: DateTime): boolean` (la regla, abajo) |
| `TaskTransformer` (lista, `POST /tasks`, `PATCH :id/status`) | `id`, `title`, `status`, `createdAt`, `assignee{…}` | **Sin cambios** (CA-11) |
| `TaskDetailTransformer` (`GET /tasks/:id`, `PUT /tasks/:id/due-date`) | `id`, `title`, `status`, `createdAt`, `assignee{…}` | + `dueDate`, + `isOverdue`; recibe el día de referencia por constructor |
| `frontend/src/lib/types.ts` | `Task` (sirve a lista y detalle) | `Task` sin cambios; + `TaskDetail = Task & { dueDate: string \| null; isOverdue: boolean }` |

## La proyección de detalle, completa

| Campo | Origen | Tipo en JSON | Nota |
|---|---|---|---|
| `id` | `tasks.id` | number | Sin cambios |
| `title` | `tasks.title` | string | Sin cambios |
| `status` | `tasks.status` | `"pending" \| "in_progress" \| "done"` | Sin cambios |
| `assignee` | `users` vía `assignee_id` | `{ id, fullName, initials }` | Sin cambios |
| `createdAt` | `tasks.created_at` | string ISO 8601 | Sin cambios |
| **`dueDate`** | `tasks.due_date` | `"AAAA-MM-DD"` \| `null` | Día de calendario, sin hora ni huso: `dueDate?.toISODate() ?? null` |
| **`isOverdue`** | **calculado** con `Task.isOverdueOn(today)` | boolean | No se guarda en ningún sitio; se calcula en cada respuesta con el día de referencia de esa petición |

## La regla: `Task.isOverdueOn(today)`

Vive **solo** aquí. Ninguna otra capa la reimplementa: el transformer la llama, el frontend pinta el booleano.

```
isOverdueOn(today) ⇔ dueDate ≠ null
                   ∧ día(dueDate) < día(today)      // estrictamente anterior, por día natural
                   ∧ status ≠ 'done'
```

`día(x)` = `x.toISODate()` (`'AAAA-MM-DD'`), en la zona propia de cada `DateTime`, sin horas. Ver [research.md §2](./research.md#2-la-regla-vive-en-el-dominio-taskisoverdueontoday).

| `dueDate` respecto a `today` | `status` ≠ `done` | `status` = `done` |
|---|---|---|
| `null` | `false` | `false` |
| anterior (ayer o antes) | **`true`** | `false` |
| igual (hoy) | `false` | `false` |
| posterior (mañana o después) | `false` | `false` |

**Día de referencia (`today`)**: el `?today=AAAA-MM-DD` de la petición (el frontend lo manda siempre con la fecha local del navegador); si no llega, `DateTime.utc()` del servidor. Nunca se guarda.

## Validación

| Entrada | Dónde | Regla | Error |
|---|---|---|---|
| `dueDate` (cuerpo del `PUT`) | `updateTaskDueDateValidator`, solo sobre `request.body()` | Clave **obligatoria**; `null`, o un día existente con formato estricto `AAAA-MM-DD` entre `1000-01-01` y `9999-12-31` | `422` `required` / `date` / `date.afterOrEqual` |
| `today` (query de `GET` y `PUT`) | `taskReadingDayValidator`, solo sobre `request.qs()` | Opcional; si llega, mismo formato y rango | `422` `date` / `date.afterOrEqual` |

Ambos comparten el builder `calendarDay()` de `app/validators/task.ts`. Una fecha pasada es válida (FR-007, CA-13). Detalle y ejemplos en [research.md §5](./research.md#5-formato-y-rango-calendarday).

## Reglas de escritura

| Regla | Origen |
|---|---|
| Cualquier miembro autenticado pone, cambia o quita la fecha de cualquier tarea; sin filtro por responsable | FR-003, CA-17 |
| `PUT` solo escribe `due_date`: `title`, `status`, `assignee_id` y `created_at` no cambian, aunque el cuerpo traiga otras claves | FR-020 |
| Una fecha inválida no escribe nada: la validación corre antes de buscar la fila | FR-008, CA-14 |
| La misma fecha que ya tenía no escribe (`updated_at` no se mueve) | Edge case «poner la misma fecha» |
| Cambiar el estado (`PATCH :id/status`) no toca `due_date` | FR-014, CA-8, SC-004 |
| Crear (`POST /tasks`) no lee ni fija `due_date`: `createTaskValidator` sigue aceptando solo `title` | FR-002, CA-1 |
| Última escritura gana entre personas; sin detección de colisiones | Assumptions (PA-8) |

## Transiciones

`due_date` no tiene máquina de estados: `null ⇄ día`, `día ⇄ otro día`, en cualquier orden. `isOverdue` no transiciona: se **recalcula** en cada lectura a partir de `due_date`, `status` y el día de referencia, así que cambia sola al pasar la medianoche de quien mira (CA-20) y al cambiar el estado en cualquier sentido (FR-014; E2-4 cerró PA-7: toda transición entre estados es válida).
