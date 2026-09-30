# Contract: `PUT /api/v1/tasks/:id/due-date`

Ruta **nueva**. Cubre FR-002, FR-004 a FR-009, FR-014, FR-017 y FR-018 en el lado del servidor. Vive dentro del grupo `tasks` existente, protegido por `middleware.auth()` (guard `api`). Nombre de ruta: `tasks.task_due_dates.update` (comprobado con `node ace list:routes`). Controlador: `TaskDueDatesController.update` (`app/controllers/task_due_dates_controller.ts`). Transformer: `TaskDetailTransformer`.

Orden de evaluación: **sesión** (`401`) → **cuerpo** (`422` en `dueDate`) → **query** (`422` en `today`) → **existencia** (`404`) → guardar (`200`). Es el mismo orden que `PATCH /tasks/:id/status`: un cuerpo inválido sobre una tarea inexistente da `422`, no `404`.

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
| `:id` | Id de la tarea. Un valor no numérico se trata como tarea inexistente (`404`). |
| `dueDate` (cuerpo, **obligatorio**) | `"AAAA-MM-DD"` con una fecha real (pasada o futura, sin tope de años) **o** `null` para quitar la fecha. |
| `today` (query, opcional) | `AAAA-MM-DD`: el día de hoy de quien mira. Si falta, el servidor usa **su propia fecha en UTC**. Solo sirve para calcular `isOverdue` en la respuesta; no se guarda. |
| Otras claves del cuerpo | Se descartan; nunca se guardan (título, estado y responsable no cambian). |

## Respuesta — éxito (200)

La tarea con la fecha ya guardada, con la forma de `TaskDetailTransformer`, envuelta por `serialize()`.

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

- `dueDate: null` en el cuerpo → `200` con `"dueDate": null` e `"isOverdue": false`. Quitar la fecha no es un error, ni siquiera si la tarea no tenía fecha.
- Una fecha anterior a `today` se acepta (`200`); si la tarea no está en `done`, la respuesta ya trae `"isOverdue": true` (CA-13).
- Poner la misma fecha que ya tenía → `200` con la tarea igual.
- Cualquier miembro autenticado sobre cualquier tarea, sin comprobar propiedad (FR-009).
- Solo cambia `due_date` (y `updated_at`); `title`, `status` y `assignee_id` quedan como estaban.

## Respuesta — fecha inválida (422)

`dueDate` imposible o mal formada (`"2026-02-31"`, `"30/09/2026"`, `"2026-9-3"`, `"mañana"`, `"2026-09-30T10:00:00Z"`, un número). Formato de error de VineJS que ya usa la API:

```json
{
  "errors": [
    { "message": "The dueDate field must be a datetime value", "rule": "date", "field": "dueDate" }
  ]
}
```

Sin `dueDate` en el cuerpo:

```json
{ "errors": [{ "message": "The dueDate field must be defined", "rule": "required", "field": "dueDate" }] }
```

`today` mal formado (con `dueDate` válido):

```json
{ "errors": [{ "message": "The today field must be a datetime value", "rule": "date", "field": "today" }] }
```

En todos los casos la tarea **conserva la fecha que tuviera** (o sigue sin fecha): la validación falla antes de leer o escribir la tarea (FR-007).

## Respuesta — sin sesión (401)

Heredado de `middleware.auth()`, sin cambios (FR-017):

```json
{ "errors": [{ "message": "Unauthorized access" }] }
```

La tarea no cambia.

## Respuesta — la tarea no existe (404)

Id que nunca existió, tarea borrada o id no numérico, con un cuerpo válido. Forma fija de `app/exceptions/handler.ts` (sin cambios desde E2-4):

```json
{ "errors": [{ "message": "Row not found" }] }
```

## Matriz de comportamiento (Definition of Done)

Principio II v1.1.0. Todos en `backend/tests/functional/tasks/update_task_due_date.spec.ts`, escritos y ejecutados **en rojo** antes que la implementación. «Cuerpo completo» = `assert.deepEqual` sobre `response.body()` entero. «BD» = releer la tarea y comprobar `dueDate` (como `AAAA-MM-DD` o `null`), `status`, `title` y `assigneeId`. `today` siempre explícito salvo en el caso #12. Una tarea testigo comprueba que no se toca otra.

| # | Rama | Preparación | Petición | Esperado |
|---|---|---|---|---|
| 1 | Poner | Tarea de Oscar sin fecha, `pending` | `PUT` `{ dueDate: '2026-10-15' }`, `today=2026-09-30` | `200`, cuerpo completo con `dueDate: '2026-10-15'`, `isOverdue: false`; BD con la fecha; testigo intacta |
| 2 | Cambiar | Tarea con `2026-10-15` | `{ dueDate: '2026-11-01' }` | `200`, cuerpo completo con la nueva; BD con la nueva |
| 3 | Quitar | Tarea con `2026-10-15` | `{ dueDate: null }` | `200`, cuerpo completo con `dueDate: null`, `isOverdue: false`; BD `null` |
| 4 | Quitar una vencida | Tarea `pending` con `2026-09-29`, `today=2026-09-30` | `{ dueDate: null }` | `200`, `isOverdue: false` en esa misma respuesta |
| 5 | Quitar sin fecha | Tarea sin fecha | `{ dueDate: null }` | `200`, `dueDate: null`; no es error |
| 6 | Fecha pasada aceptada | Tarea `pending` sin fecha | `{ dueDate: '2026-09-01' }`, `today=2026-09-30` | `200`, `dueDate: '2026-09-01'`, `isOverdue: true`; BD con la fecha |
| 7 | Aplazar resuelve | Tarea `pending` con `2026-09-29` | `{ dueDate: '2026-10-05' }`, `today=2026-09-30` | `200`, `isOverdue: false` |
| 8 | Tarea ajena | Tarea de Ana | Oscar hace `PUT` | `200`, cuerpo completo con `assignee` = Ana; sin campos extra |
| 9 | Solo toca la fecha | Tarea `in_progress` | `{ dueDate: '2026-10-15', title: 'X', status: 'done', assigneeId: <Ana> }` | `200`; BD con la fecha y `title`/`status`/`assigneeId` sin cambios |
| 10 | `done` con fecha pasada | Tarea `done` | `{ dueDate: '2026-09-01' }`, `today=2026-09-30` | `200`, `isOverdue: false` |
| 11 | `today` distinto, misma fecha | Tarea `pending` | `{ dueDate: '2026-09-30' }` con `today=2026-09-30` y luego con `today=2026-10-01` | primera `isOverdue: false`; segunda `true` |
| 12 | Sin `today` → UTC | Tarea `pending` | `{ dueDate: <ayer en UTC> }` sin query | `200`, `isOverdue: true` (se calcula con `DateTime.utc()` en el propio test) |
| 13 | `422` fecha imposible | Tarea con `2026-10-15` | `{ dueDate: '2026-02-31' }` | `422`, cuerpo completo (`rule: 'date'`); BD sigue con `2026-10-15` |
| 14 | `422` formato ajeno | Tarea con `2026-10-15` | `{ dueDate: '30/09/2026' }` | `422`, mismo cuerpo; BD intacta |
| 15 | `422` texto | Tarea sin fecha | `{ dueDate: 'mañana' }` | `422`, mismo cuerpo; BD sigue `null` |
| 16 | `422` con hora | Tarea sin fecha | `{ dueDate: '2026-09-30T10:00:00Z' }` | `422`, mismo cuerpo |
| 17 | `422` sin la clave | Tarea con fecha | `{}` | `422`, cuerpo `required`; BD intacta |
| 18 | `422` `today` mal formado | Tarea sin fecha | `{ dueDate: '2026-10-15' }`, `today=30-09-2026` | `422`, cuerpo en `today`; BD sigue `null` |
| 19 | `401` sin sesión | Tarea con `2026-10-15` | Sin `loginAs` | `401`, cuerpo completo; BD intacta |
| 20 | `401` token no válido | Tarea con fecha | `Authorization: Bearer oat_no-es-un-token` | `401`, mismo cuerpo; BD intacta |
| 21 | `404` id inexistente | — | `PUT /api/v1/tasks/999999/due-date` con cuerpo válido | `404`, `{ errors: [{ message: 'Row not found' }] }` |
| 22 | `404` tarea borrada | Crear tarea, `task.delete()` | `PUT` con cuerpo válido | `404`, mismo cuerpo |
| 23 | `404` id no numérico | — | `PUT /api/v1/tasks/abc/due-date` con cuerpo válido | `404`, mismo cuerpo |

Regresión: `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` siguen en verde **sin editarse**. Sobre `show_task.spec.ts`, ver [task-detail-api.md](./task-detail-api.md) y el Constitution Check del plan.
