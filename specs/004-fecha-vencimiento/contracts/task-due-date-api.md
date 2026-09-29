# Contract: `PUT /api/v1/tasks/:id/due-date`

Cubre FR-003, FR-005 a FR-008, FR-010, FR-011, FR-019 y FR-020 en el lado del servidor. Ruta **nueva**, dentro del grupo `tasks` existente protegido por `middleware.auth()` (guard `api`). Controlador: `TaskDueDatesController.update` (`backend/app/controllers/task_due_dates_controller.ts`). Transformer: `TaskDetailTransformer`. Ninguna ruta existente cambia.

Orden de evaluación: **sesión** (`401`) → **cuerpo** (`422`) → **`today`** (`422`) → **existencia** (`404`) → escritura y respuesta (`200`). Nada se escribe si falla cualquier paso anterior.

## Request

```
PUT /api/v1/tasks/12/due-date?today=2026-09-30
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{ "dueDate": "2026-10-15" }
```

| Parte | Regla |
|---|---|
| `:id` | Id de la tarea. Sin matcher: no numérico → `404` (como `GET /tasks/:id`). |
| Cuerpo `dueDate` | **Obligatorio.** `"AAAA-MM-DD"` (día que exista, de `1000-01-01` a `9999-12-31`, pasado o futuro) para poner o cambiar; `null` para quitar. Se lee **solo del cuerpo**. |
| Cuerpo, otras claves | Se ignoran: nunca se persisten (`status`, `title`, `assigneeId`…). |
| Query `today` | **Opcional.** `"AAAA-MM-DD"`, mismo formato y rango. Día de referencia para calcular `isOverdue` en la respuesta. Sin él, el servidor usa **su fecha UTC**. Se lee **solo de la query**. |

## Respuesta — éxito (200)

La tarea entera, con la forma de `TaskDetailTransformer` ([task-detail-api.md](./task-detail-api.md#respuesta--éxito-200)), ya con la fecha nueva y la condición recalculada con `today`:

```json
{
  "data": {
    "id": 12,
    "title": "Revisar el PR de auth",
    "status": "in_progress",
    "assignee": { "id": 3, "fullName": "Ana Ruiz", "initials": "AR" },
    "createdAt": "2026-09-23T10:15:00.000Z",
    "dueDate": "2026-10-15",
    "isOverdue": false
  }
}
```

- `dueDate: null` en el cuerpo → `"dueDate": null`, `"isOverdue": false` en la respuesta (CA-3).
- Una fecha anterior a `today` se acepta, sin aviso, y vuelve con `"isOverdue": true` si la tarea no está en `done` (CA-13).
- Igual para cualquier miembro autenticado, sea o no el responsable (CA-17).
- La misma fecha que ya tenía → `200` con la misma forma y `updated_at` sin moverse.
- `{ "dueDate": "" }` **quita la fecha**, igual que `null`: `config/bodyparser.ts` tiene `convertEmptyStringsToNull: true` para JSON (configuración global que este cambio no toca), así que el validador ya recibe `null`. El frontend nunca envía `""`; se documenta y se aserta para que no sea una sorpresa.

## Respuesta — entrada inválida (422)

Formato de error de VineJS que ya usa la API (`{ errors: [{ message, rule, field, meta? }] }`). **La tarea conserva la fecha que tuviera** (o sigue sin fecha).

| Caso | Ejemplos | Cuerpo |
|---|---|---|
| Falta la clave | `{}` | `{ "errors": [{ "message": "The dueDate field must be defined", "rule": "required", "field": "dueDate" }] }` |
| Día inexistente | `"2026-02-31"`, `"2025-02-29"`, `"2026-04-31"` | `{ "errors": [{ "message": "The dueDate field must be a datetime value", "rule": "date", "field": "dueDate" }] }` |
| Mal formada o con hora | `"30/09/2026"`, `"2026-9-30"`, `"2026-09-30T00:00:00Z"`, `"mañana"`, `20260930`, `"10000-01-01"` | Igual que la fila anterior |
| Fuera de rango inferior | `"0999-12-31"` | `{ "errors": [{ "message": "The dueDate field must be a date after or equal to 1000-01-01", "rule": "date.afterOrEqual", "field": "dueDate", "meta": { … } }] }` (el `meta` exacto se fija en el test con lo que devuelva VineJS 4.4) |
| `today` inválido | `?today=2026-02-31`, `?today=30/09/2026` | Igual que las filas `date`, con `"field": "today"` |

Si el cuerpo y `today` son inválidos a la vez, responde el error del cuerpo (se valida primero). Con cuerpo inválido y tarea inexistente, responde `422` (se valida antes de buscar).

## Respuesta — sin sesión (401)

Comportamiento heredado de `middleware.auth()`, sin cambios (FR-019):

```json
{ "errors": [{ "message": "Unauthorized access" }] }
```

Nada se escribe.

## Respuesta — la tarea no existe (404)

Id que nunca existió, tarea borrada o id no numérico, con un cuerpo válido. Rama `E_ROW_NOT_FOUND` de `app/exceptions/handler.ts`, sin cambios:

```json
{ "errors": [{ "message": "Row not found" }] }
```

## Matriz de comportamiento (Definition of Done)

Principio II v1.1.0. Todos en `backend/tests/functional/tasks/update_task_due_date.spec.ts`, escritos y ejecutados en **rojo** antes que la implementación. «Cuerpo completo» = `assert.deepEqual` sobre `response.body()` entero, con `createdAt` tomado de `GET /api/v1/tasks`. «BD» = releer la tarea (`dueDate?.toISODate() ?? null`, `status`, `title`, `assigneeId`, `updatedAt`). Todas las peticiones llevan `today=2026-09-30` salvo que se diga otra cosa.

| # | Rama | Preparación | Petición | Esperado |
|---|---|---|---|---|
| 1 | Poner | Tarea de Oscar sin fecha, `pending` | Oscar: `{ dueDate: '2026-10-15' }` | `200`, cuerpo completo con `dueDate: '2026-10-15'`, `isOverdue: false`; BD con esa fecha y resto intacto |
| 2 | Cambiar | Tarea con `2026-10-15` | `{ dueDate: '2026-11-01' }` | `200`, cuerpo completo con `'2026-11-01'`; BD igual |
| 3 | Quitar | Tarea con `2026-10-15` | `{ dueDate: null }` | `200`, cuerpo completo con `dueDate: null`, `isOverdue: false`; BD `null` |
| 4 | Fecha pasada aceptada | Tarea sin fecha, `pending` | `{ dueDate: '2026-09-01' }` | `200`, cuerpo completo con `isOverdue: true` (CA-13) |
| 5 | Quitar deja de vencer | Tarea `pending` con `2026-09-01` (vencida) | `{ dueDate: null }` | `200`, `isOverdue: false` **en esa misma respuesta** (CA-3) |
| 6 | Aplazar deja de vencer | Tarea `pending` con `2026-09-01` | `{ dueDate: '2026-10-15' }` | `200`, `isOverdue: false` (CA-10) |
| 7 | Tarea ajena | Tarea de Ana | Oscar: `{ dueDate: '2026-10-15' }` | `200`, cuerpo completo con `assignee` = Ana; sin campos extra (CA-17) |
| 8 | Solo escribe la fecha | Tarea `pending` | `{ dueDate: '2026-10-15', status: 'done', title: 'x', assigneeId: <otro> }` | `200`; BD: `status`, `title`, `assigneeId` sin cambios |
| 9 | Misma fecha | Tarea con `2026-10-15` | `{ dueDate: '2026-10-15' }` | `200`, cuerpo completo; `updatedAt` sin moverse |
| 10 | Rango: extremos válidos | Tarea sin fecha | `'1000-01-01'`, luego `'9999-12-31'` | `200` en ambos, con esa fecha |
| 10b | Cadena vacía = quitar | Tarea con `2026-10-15` | `{ dueDate: '' }` | `200`, `dueDate: null` (bodyparser → `null`); BD `null` |
| 11 | `422` día inexistente | Tarea con `2026-10-15` | `{ dueDate: '2026-02-31' }` | `422`, cuerpo `date` completo; BD conserva `2026-10-15` (CA-14) |
| 12 | `422` mal formada | Tarea con `2026-10-15` | `'30/09/2026'`, `'2026-9-30'`, `'2026-09-30T00:00:00Z'`, `'mañana'` | `422`, cuerpo `date` completo en cada una; BD conserva `2026-10-15` |
| 13 | `422` sin fecha previa | Tarea sin fecha | `{ dueDate: '2025-02-29' }` | `422`; BD sigue `null` |
| 14 | `422` falta la clave | Tarea con `2026-10-15` | `{}` | `422`, cuerpo `required` completo; BD conserva la fecha |
| 15 | `422` fuera de rango | Tarea sin fecha | `'0999-12-31'` y `'10000-01-01'` | `422` (`date.afterOrEqual` y `date`); BD sigue `null` |
| 16 | `422` `today` inválido | Tarea con `2026-10-15` | `?today=2026-02-31`, cuerpo válido | `422`, cuerpo `date` con `field: 'today'`; BD conserva `2026-10-15` |
| 17 | La fecha solo sale del cuerpo | Tarea con `2026-10-15` | `?dueDate=2026-11-01` y cuerpo `{}` | `422` `required`; BD conserva `2026-10-15` |
| 18 | Sin `today` usa UTC | Tarea `pending` | Sin query, `{ dueDate: <UTC hoy − 2 días> }` | `200`, `isOverdue: true` |
| 19 | `401` sin sesión | Tarea con `2026-10-15` | Sin `loginAs` | `401`, `{ errors: [{ message: 'Unauthorized access' }] }`; BD intacta |
| 20 | `401` token no válido | Igual | `Authorization: Bearer oat_no-es-un-token` | `401`, mismo cuerpo; BD intacta |
| 21 | `404` id inexistente | — | `PUT /api/v1/tasks/999999/due-date`, cuerpo válido | `404`, `{ errors: [{ message: 'Row not found' }] }` |
| 22 | `404` tarea borrada | Crear y `task.delete()` | Cuerpo válido | `404`, mismo cuerpo |
| 23 | `404` id no numérico | — | `PUT /api/v1/tasks/abc/due-date`, cuerpo válido | `404`, mismo cuerpo |
| 24 | `422` antes que `404` | — | `PUT /api/v1/tasks/999999/due-date`, `{ dueDate: 'mañana' }` | `422` |
