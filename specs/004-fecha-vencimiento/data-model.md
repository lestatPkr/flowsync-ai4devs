# Data Model: Fecha de vencimiento y tareas vencidas

## Tabla `tasks` — columna nueva

| Columna | Tipo | Nulo | Default | Origen |
|---|---|---|---|---|
| `due_date` | `date` | sí | ninguno | migración `add_due_date_to_tasks` |

El resto de columnas (`id`, `title`, `status`, `assignee_id`, `created_at`, `updated_at`) no cambian.

### Migración

- **`up`**: `alterTable('tasks')` → `table.date('due_date').nullable()`.
- **`down`**: `alterTable('tasks')` → `table.dropColumn('due_date')`. Deja el esquema como estaba antes de FS-118.
- **Datos existentes**: las tareas anteriores quedan con `due_date = NULL`, que es «sin fecha»: un estado normal, válido y sin aviso (RF-13). No hace falta rellenar nada.
- **Base compartida**: desarrollo y pruebas usan el mismo `tmp/db.sqlite3`; migrar cambia también el estado local.

### Por qué `date` y no `datetime`

- La fecha de vencimiento es un **día natural, sin hora ni zona** (Clarifications 2026-09-30). `date` guarda exactamente eso y nada más.
- Un `datetime` obligaría a elegir una hora (¿medianoche? ¿fin del día?) y una zona (¿la de quien la puso? ¿UTC?). Con ellas vuelve el error del día de más: `2026-09-30T00:00Z` es el 29 en América. Y dejaría de ser verdad que todas las personas ven la misma fecha, que es lo que la spec exige.
- La hora solo entra en juego en el **«hoy»** de quien mira, que no se guarda: llega con cada petición (FR-011).

### Por qué nullable y sin default

- «Sin fecha» es el camino por defecto (RF-13, FR-001). Un default inventaría un compromiso que nadie ha adquirido.
- `NULL` distingue «sin fecha» de cualquier fecha real, sin valores centinela.

## Modelo `Task` (`app/models/task.ts`)

- **`dueDate: DateTime | null`**: heredado de `TaskSchema`, que genera `node ace migration:run` con `@column.date()`. No se redeclara en el modelo.
- **`isOverdueOn(today: DateTime): boolean`**: la regla de vencimiento, y el único sitio donde vive (RF-14, FR-010).

### Regla de vencimiento

`isOverdueOn(today)` es `true` si y solo si se cumplen las tres condiciones:

1. `dueDate !== null`;
2. `dueDate.toISODate() < today.toISODate()`: el día de la fecha es **estrictamente anterior** al día de referencia, comparando días naturales `AAAA-MM-DD`, sin horas;
3. `status !== 'done'`.

| `dueDate` respecto a `today` | `status` | `isOverdueOn` |
|---|---|---|
| día anterior (o antes) | `pending` / `in_progress` | **true** |
| mismo día | `pending` / `in_progress` | false |
| día posterior (o después) | `pending` / `in_progress` | false |
| `null` | cualquiera | false |
| día anterior (o antes) | `done` | false |

**No es un dato guardado**: se calcula en cada lectura con el `today` de esa petición. Por eso una tarea pasa a vencida por el mero avance del día (CA-20), y dos personas con `today` distintos ven lecturas distintas de la misma tarea, ambas correctas (CA-19).

### Transiciones que afectan al vencimiento

Ninguna guarda ni borra nada aparte de la propia fecha o el estado; la lectura se recalcula siempre.

| Acción | Efecto sobre `due_date` | Efecto sobre la condición de vencida |
|---|---|---|
| Poner una fecha pasada | se guarda | vencida si no está en `done` (CA-13) |
| Aplazar a hoy o a una fecha posterior | se guarda la nueva | deja de estarlo (CA-10) |
| Quitar la fecha (`null`) | pasa a `NULL` | deja de estarlo (CA-3) |
| Pasar a `done` (E2-4, desde la lista) | **sin cambios** (FR-014) | deja de estarlo (CA-8) |
| Volver de `done` con fecha pasada | sin cambios | vuelve a estarlo (US2, escenario 10) |
| Pasa la medianoche de quien mira | sin cambios | una fecha de «hoy» pasa a vencida (CA-20) |
| Fecha imposible o mal formada | **sin cambios**: `422` antes de tocar la tarea | sin cambios (CA-14) |

## Validación (`app/validators/task.ts`)

| Validador | Campo | Regla | Acepta | Rechaza (`422`) |
|---|---|---|---|---|
| `updateTaskDueDateValidator` | `dueDate` (cuerpo) | `vine.date({ formats: ['YYYY-MM-DD'] }).nullable()`, parseo estricto | `"2026-09-30"`, cualquier fecha real pasada o futura, `null` | `"2026-02-31"`, `"30/09/2026"`, `"2026-9-3"`, `"mañana"`, `"2026-09-30T10:00:00Z"`, números, clave ausente (`required`) |
| `todayQueryValidator` | `today` (query) | `vine.date({ formats: ['YYYY-MM-DD'] }).optional()`, parseo estricto | `"2026-09-30"`, ausente | mismo conjunto de mal formados |

## Representación en la API

| Campo | Lista (`TaskTransformer`) | Detalle (`TaskDetailTransformer`) |
|---|---|---|
| `dueDate` | — (no aparece) | `"AAAA-MM-DD"` o `null` |
| `isOverdue` | — (no aparece) | `true` / `false`, calculado con el `today` de la petición |

Tipos del frontend (`frontend/src/lib/types.ts`): `Task` (lista) sin cambios; `TaskDetail = Task & { dueDate: string | null; isOverdue: boolean }`.
