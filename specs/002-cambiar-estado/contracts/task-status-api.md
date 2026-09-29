# Contract: `PATCH /api/v1/tasks/:id/status`

Cubre FR-001 a FR-010. Vive dentro del grupo `tasks` existente, protegido por `middleware.auth()` (guard `api`). Nombre de ruta: `tasks.task_statuses.update`. Controlador: `TaskStatusesController.update`. Las rutas existentes (`GET`/`POST /api/v1/tasks`, `/auth/*`, `/account/*`) no cambian.

Orden de evaluación: **sesión** (`401`) → **cuerpo** (`422`) → **existencia** (`404`) → escritura (`200`). Un cuerpo inválido sobre un id inexistente responde `422` (ver [research.md §2](../research.md#2-validador-y-orden-validación--búsqueda)).

## Request

```
PATCH /api/v1/tasks/12/status
Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json

{ "status": "in_progress" }
```

| Parte | Regla |
|---|---|
| `:id` | Id de la tarea. Sin matcher: un valor no numérico se trata como tarea inexistente (`404`). |
| `status` | Obligatorio. Uno de `"pending"`, `"in_progress"`, `"done"` (`TASK_STATUSES`). Sensible a mayúsculas; las etiquetas en castellano (`"Hecho"`) no son válidas. |
| Otras claves | Se ignoran: `title`, `assigneeId` o cualquier otra no se leen ni se persisten (FR-004). |

## Respuesta — éxito (200)

Cualquier transición entre los tres estados, en cualquier sentido, y también el mismo estado que ya tenía. Cuerpo: la tarea completa tras el cambio, con la forma de `TaskTransformer`, envuelta por `serialize()`. Es **exactamente** la misma forma que devuelven `GET` y `POST /api/v1/tasks` para una tarea.

```json
{
  "data": {
    "id": 12,
    "title": "Revisar el PR de auth",
    "status": "in_progress",
    "assignee": { "id": 3, "fullName": "Oscar Torres", "initials": "OT" },
    "createdAt": "2026-09-23T10:15:00.000Z"
  }
}
```

- `status` es el pedido (FR-007).
- `id`, `title`, `assignee` y `createdAt` son los que la tarea ya tenía (FR-004), también cuando quien cambia el estado no es el responsable (FR-003).
- El cambio está persistido: un `GET /api/v1/tasks` posterior devuelve la tarea con el nuevo `status`.

## Respuesta — estado no válido (422)

Valor fuera del catálogo (incluye `"archived"`, `"Hecho"`, `"DONE"`):

```json
{
  "errors": [
    {
      "message": "The selected status is invalid",
      "rule": "enum",
      "field": "status",
      "meta": { "choices": ["pending", "in_progress", "done"] }
    }
  ]
}
```

Clave `status` ausente, `null` o `""` (el bodyparser JSON tiene `convertEmptyStringsToNull: true`, así que `""` llega como `null`):

```json
{
  "errors": [
    { "message": "The status field must be defined", "rule": "required", "field": "status" }
  ]
}
```

La tarea conserva el estado que tenía (FR-008). El frontend traduce estos errores (ver [task-status-ui.md](./task-status-ui.md#mensajes)).

## Respuesta — sin sesión (401)

Sin `Authorization` o con un token inválido/revocado. Comportamiento heredado de `middleware.auth()`, sin cambios (FR-010):

```json
{ "errors": [{ "message": "Unauthorized access" }] }
```

La tarea conserva su estado.

## Respuesta — la tarea no existe (404)

Id que nunca existió, tarea borrada después de cargar la lista, o id no numérico. `Task.findOrFail` lanza `E_ROW_NOT_FOUND`, que `app/exceptions/handler.ts` renderiza con forma fija en todos los entornos (ver [research.md §3](../research.md#3-forma-determinista-del-404)):

```json
{ "errors": [{ "message": "Row not found" }] }
```

No se crea ni modifica ninguna tarea (FR-009).

## Matriz de comportamiento (Definition of Done)

Principio II v1.1.0. Todos en `backend/tests/functional/tasks/update_task_status.spec.ts`, escritos antes que la implementación. «Cuerpo completo» = `assert.deepEqual` sobre `response.body()` entero. «BD intacta» = releer la tarea y comprobar `status`, `title` y `assigneeId` sin cambios.

| # | Rama | Preparación | Petición | Esperado |
|---|---|---|---|---|
| 1-6 | Camino feliz (dataset) | Tarea en `from` | `{ status: to }` para `pending→in_progress`, `pending→done`, `in_progress→pending`, `in_progress→done`, `done→pending`, `done→in_progress` | `200`, cuerpo completo con `status: to`; BD en `to` |
| 7 | Camino feliz, mismo estado | Tarea en `done` | `{ status: 'done' }` | `200`, cuerpo completo con `status: 'done'` |
| 8 | Camino feliz, tarea ajena | Tarea asignada a Ana; pide Oscar | `{ status: 'done' }` | `200`, cuerpo completo con `assignee` = Ana; BD: `assigneeId` sigue siendo Ana |
| 9 | Camino feliz, claves extra | Tarea «Original» de Oscar | `{ status: 'done', title: 'Hackeado', assigneeId: <Ana> }` | `200`, cuerpo completo con `title: 'Original'` y `assignee` = Oscar; BD igual |
| 10 | `422` fuera de catálogo (dataset) | Tarea en `pending` | `{ status: 'archived' }`, `{ status: 'Hecho' }`, `{ status: 'DONE' }` | `422`, cuerpo completo `rule: 'enum'` con `meta.choices`; BD intacta |
| 11 | `422` ausente (dataset) | Tarea en `pending` | `{}`, `{ status: '' }` | `422`, cuerpo completo `rule: 'required'`; BD intacta |
| 12 | `401` sin sesión | Tarea en `pending` | Sin `loginAs`, `{ status: 'done' }` | `401`, `{ errors: [{ message: 'Unauthorized access' }] }`; BD intacta |
| 13 | `404` id inexistente | BD sin esa tarea | `PATCH /api/v1/tasks/999999/status` `{ status: 'done' }` | `404`, `{ errors: [{ message: 'Row not found' }] }` |
| 14 | `404` tarea borrada | Crear tarea, `task.delete()` | `{ status: 'done' }` | `404`, mismo cuerpo; sigue sin haber tareas |
| 15 | `404` id no numérico | — | `PATCH /api/v1/tasks/abc/status` | `404`, mismo cuerpo |

Regresión: `create_task.spec.ts` y `list_tasks.spec.ts` siguen en verde **sin editarse** (las rutas existentes no cambian).
