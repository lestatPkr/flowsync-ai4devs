# Contract: `GET /api/v1/tasks/:id`

Cubre FR-001, FR-002, FR-005, FR-007 a FR-010 y FR-012 en el lado del servidor. Vive dentro del grupo `tasks` existente, protegido por `middleware.auth()` (guard `api`). Nombre de ruta: `tasks.show`. Controlador: `TasksController.show`. Transformer: `TaskDetailTransformer`. Las rutas existentes (`GET`/`POST /api/v1/tasks`, `PATCH /api/v1/tasks/:id/status`, `/auth/*`, `/account/*`) no cambian.

Orden de evaluación: **sesión** (`401`) → **existencia** (`404`) → lectura (`200`). No hay cuerpo que validar: **no existe rama `422`** ([research.md §4](../research.md#4-id-no-numérico-y-por-qué-no-hay-422)).

## Request

```
GET /api/v1/tasks/12
Authorization: Bearer <token>
Accept: application/json
```

| Parte | Regla |
|---|---|
| `:id` | Id de la tarea. Sin matcher: un valor no numérico se trata como tarea inexistente (`404`). |
| Cuerpo / query | No se leen. |

## Respuesta — éxito (200)

La tarea pedida, con la forma de `TaskDetailTransformer`, envuelta por `serialize()`. Hoy es campo a campo la misma forma que devuelve `GET /api/v1/tasks` para esa tarea.

```json
{
  "data": {
    "id": 12,
    "title": "Revisar el PR de auth",
    "status": "in_progress",
    "assignee": { "id": 3, "fullName": "Ana Ruiz", "initials": "AR" },
    "createdAt": "2026-09-23T10:15:00.000Z"
  }
}
```

- Es la tarea del `:id` pedido y ninguna otra (FR-002).
- Igual para cualquier miembro autenticado, sea o no el responsable, sin campos ni avisos distintos (FR-007).
- `title` completo, sin recortar.
- No modifica la tarea: `updated_at` no se mueve (FR-005).

## Respuesta — sin sesión (401)

Sin `Authorization`, o con un token inválido o revocado. Comportamiento heredado de `middleware.auth()`, sin cambios (FR-008):

```json
{ "errors": [{ "message": "Unauthorized access" }] }
```

Ningún dato de la tarea en el cuerpo.

## Respuesta — la tarea no existe (404)

Id que nunca existió, tarea borrada, o id no numérico. `Task.findOrFail` lanza `E_ROW_NOT_FOUND`, que `app/exceptions/handler.ts` (sin cambios desde E2-4) renderiza con forma fija en todos los entornos:

```json
{ "errors": [{ "message": "Row not found" }] }
```

## Matriz de comportamiento (Definition of Done)

Principio II v1.1.0. Todos en `backend/tests/functional/tasks/show_task.spec.ts`, escritos y ejecutados en rojo antes que la implementación. «Cuerpo completo» = `assert.deepEqual` sobre `response.body()` entero. «BD intacta» = releer la tarea y comprobar `status`, `title`, `assigneeId` y `updatedAt` sin cambios. `createdAt` esperado = el que devuelve `GET /api/v1/tasks` para esa tarea.

| # | Rama | Preparación | Petición | Esperado |
|---|---|---|---|---|
| 1 | Camino feliz, tarea propia | Tarea de Oscar en `pending` | Oscar: `GET /api/v1/tasks/:id` | `200`, cuerpo completo; BD intacta |
| 2 | Camino feliz, la pedida entre varias | Tres tareas de Oscar | Oscar pide la del medio | `200`, cuerpo completo con `id`/`title` de esa y no de otra |
| 3 | Camino feliz, tarea ajena | Tarea de Ana en `in_progress` | Oscar la pide | `200`, cuerpo completo con `assignee` = Ana; sin campos extra; BD intacta |
| 4 | Camino feliz, coincide con la lista | Tarea de Ana | Oscar pide `GET /tasks` y `GET /tasks/:id` | `data` del detalle `deepEqual` a la fila de esa tarea en la lista |
| 5 | Camino feliz, `done` | Tarea en `done` | `GET /tasks/:id` | `200`, cuerpo completo con `status: 'done'` |
| 6 | Camino feliz, título largo | Tarea con título de 200 caracteres | `GET /tasks/:id` | `200`, cuerpo completo con el título entero |
| 7 | `401` sin sesión | Tarea de Oscar | Sin `loginAs` | `401`, `{ errors: [{ message: 'Unauthorized access' }] }`; BD intacta |
| 8 | `401` token no válido | Tarea de Oscar | `Authorization: Bearer oat_no-es-un-token` | `401`, mismo cuerpo |
| 9 | `404` id inexistente | BD sin esa tarea | `GET /api/v1/tasks/999999` | `404`, `{ errors: [{ message: 'Row not found' }] }` |
| 10 | `404` tarea borrada | Crear tarea, `task.delete()` | `GET /tasks/:id` | `404`, mismo cuerpo |
| 11 | `404` id no numérico | — | `GET /api/v1/tasks/abc` | `404`, mismo cuerpo |
| — | `422` | No aplica | El endpoint no recibe cuerpo ni query; `:id` inválido es `404` (#11) | — |

Regresión: `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` siguen en verde **sin editarse**.
