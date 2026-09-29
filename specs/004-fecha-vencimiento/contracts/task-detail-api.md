# Contract: `GET /api/v1/tasks/:id` con `today` (cambio aditivo)

Cubre FR-011 a FR-017 y FR-022 en el lado del servidor. Es la ruta de E2-5 ([specs/003-abrir-tarea/contracts/task-detail-api.md](../../003-abrir-tarea/contracts/task-detail-api.md)), **sin cambio de path, verbo ni de las claves que ya devolvía**. Este cambio le añade:

1. un parámetro de consulta **opcional** `today`, y
2. dos claves en `data`: `dueDate` e `isOverdue`.

Controlador: `TasksController.show`. Transformer: `TaskDetailTransformer`. Sigue dentro del grupo `tasks` con `middleware.auth()`.

Orden de evaluación: **sesión** (`401`) → **`today`** (`422`) → **existencia** (`404`) → lectura (`200`).

## Request

```
GET /api/v1/tasks/12?today=2026-09-30
Authorization: Bearer <token>
Accept: application/json
```

| Parte | Regla |
|---|---|
| `:id` | Sin cambios respecto a E2-5 (no numérico → `404`). |
| Query `today` | **Opcional.** `"AAAA-MM-DD"`, día existente entre `1000-01-01` y `9999-12-31`. Es el día de hoy **de quien mira**: el frontend lo envía siempre, con la fecha local del navegador. **Si no llega, el servidor usa su propia fecha UTC** (`DateTime.utc()`). Solo se lee de la query. |
| Cuerpo | No se lee. |

Sin `today`, la petición de E2-5 sigue funcionando igual y recibe las mismas claves de antes más las dos nuevas.

## Respuesta — éxito (200)

```json
{
  "data": {
    "id": 12,
    "title": "Revisar el PR de auth",
    "status": "in_progress",
    "assignee": { "id": 3, "fullName": "Ana Ruiz", "initials": "AR" },
    "createdAt": "2026-09-23T10:15:00.000Z",
    "dueDate": "2026-09-29",
    "isOverdue": true
  }
}
```

| Clave | Tipo | Regla |
|---|---|---|
| `id`, `title`, `status`, `assignee`, `createdAt` | — | **Sin cambios** respecto a E2-5. |
| `dueDate` | `"AAAA-MM-DD"` \| `null` | El día guardado, igual para cualquier `today` y cualquier persona. `null` si no tiene. |
| `isOverdue` | boolean | `Task.isOverdueOn(today)`: `true` **si y solo si** `dueDate` no es `null`, `dueDate` es estrictamente anterior a `today` y `status` no es `done`. Se calcula en cada respuesta; no se guarda. |

## Respuesta — `today` inválido (422)

Formato de VineJS, `field: "today"`:

```json
{ "errors": [{ "message": "The today field must be a datetime value", "rule": "date", "field": "today" }] }
```

Con `today` fuera del rango inferior, regla `date.afterOrEqual`. Antes de este cambio la query se ignoraba; ahora un `today` presente e inválido se rechaza en vez de dar una lectura con un día que no es el de quien mira. Una petición sin `today` nunca recibe `422`.

## Respuesta — `401` y `404`

Sin cambios respecto a E2-5: `{ "errors": [{ "message": "Unauthorized access" }] }` y `{ "errors": [{ "message": "Row not found" }] }`.

## `GET /api/v1/tasks` (lista) — sin cambios

`TaskTransformer` no cambia: cada elemento sigue siendo `{ id, title, status, assignee, createdAt }`, **sin** `dueDate` ni `isOverdue`, tenga la tarea fecha o no, esté vencida o no (CA-11, FR-017). Lo mismo para las respuestas de `POST /api/v1/tasks` y `PATCH /api/v1/tasks/:id/status`.

## Matriz de comportamiento (Definition of Done)

Principio II v1.1.0. «Cuerpo completo» = `assert.deepEqual` sobre `response.body()` entero. Las fechas se preparan con `Task.create({ …, dueDate: DateTime.fromISO('…') })` o con el `PUT`.

**`backend/tests/functional/tasks/task_overdue.spec.ts`** (nuevo, escrito y ejecutado en **rojo** antes de la implementación):

| # | Rama | Preparación | Petición | Esperado |
|---|---|---|---|---|
| 1 | Borde: día anterior | `pending`, `dueDate 2026-09-29` | `?today=2026-09-30` | `200`, cuerpo completo, `dueDate: '2026-09-29'`, `isOverdue: true` (CA-4) |
| 2 | Borde: mismo día | `pending`, `2026-09-30` | `?today=2026-09-30` | `isOverdue: false` (CA-5) |
| 3 | Borde: día posterior | `pending`, `2026-10-01` | `?today=2026-09-30` | `isOverdue: false` (CA-6) |
| 4 | Borde: sin fecha | `pending`, sin fecha | `?today=2026-09-30` | `dueDate: null`, `isOverdue: false` (CA-7) |
| 5 | `in_progress` vence igual | `in_progress`, `2026-09-29` | `?today=2026-09-30` | `isOverdue: true` |
| 6 | Hecha con fecha pasada | `done`, `2026-09-01` | `?today=2026-09-30` | `isOverdue: false`, `dueDate: '2026-09-01'` (CA-9) |
| 7 | Dos días de referencia | Una tarea `pending`, `2026-09-29` | `?today=2026-09-30` y `?today=2026-09-29` | `true` y `false`; las dos con `dueDate: '2026-09-29'` (CA-19, SC-005) |
| 8 | Pasa la medianoche | `pending`, `2026-09-30`, sin tocarla | `?today=2026-09-30` y luego `?today=2026-10-01` | `false` y luego `true`; `updatedAt` sin moverse entre las dos (CA-20) |
| 9 | Retirar deja de vencer | `pending`, `2026-09-29` | `PUT …/due-date?today=2026-09-30` `{ dueDate: null }` | `isOverdue: false` en esa misma respuesta; `GET` posterior igual (CA-3) |
| 10 | Hecho conserva la fecha | `pending`, `2026-09-29` | `PATCH :id/status { status: 'done' }`, luego `GET ?today=2026-09-30` | `dueDate: '2026-09-29'`, `isOverdue: false` (CA-8, SC-004) |
| 11 | Salir de Hecho vuelve a vencer | `done`, `2026-09-29` | `PATCH … { status: 'pending' }`, luego `GET ?today=2026-09-30` | `dueDate: '2026-09-29'`, `isOverdue: true` (User Story 2 esc. 7) |
| 12 | Crear no pone fecha | — | `POST /api/v1/tasks { title }`, luego `GET` del id | `dueDate: null`, `isOverdue: false` (CA-1, FR-002) |
| 13 | Crear ignora `dueDate` en el cuerpo | — | `POST /api/v1/tasks { title, dueDate: '2026-09-01' }` | `201`; `GET` del id → `dueDate: null` |
| 14 | Sin `today`: fallback UTC, vencida | `pending`, `dueDate` = UTC hoy − 2 días | `GET` sin query | `isOverdue: true` |
| 15 | Sin `today`: fallback UTC, no vencida | `pending`, `dueDate` = UTC hoy + 2 días | `GET` sin query | `isOverdue: false` |
| 16 | `422` `today` inexistente | Tarea cualquiera | `?today=2026-02-31` | `422`, cuerpo `date` completo con `field: 'today'` |
| 17 | `422` `today` mal formado | Tarea cualquiera | `?today=30/09/2026` | `422`, mismo cuerpo |
| 18 | La lista no lleva la fecha | Tres tareas: sin fecha, con fecha futura, vencida | `GET /api/v1/tasks` | `200`; cada elemento con **exactamente** las claves `id, title, status, assignee, createdAt` (`assert.deepEqual` de `Object.keys(...).sort()`), sin `dueDate` ni `isOverdue` (CA-11) |
| 19 | Poner fecha no cambia la fila | Tarea sin fecha | Fila de `GET /tasks` antes, `PUT` una fecha, fila después | Las dos filas `deepEqual` (User Story 3 esc. 4) |
| 20 | Tareas anteriores quedan sin fecha | Tarea creada sin `dueDate` (como las existentes tras la migración) | `GET ?today=2026-09-30` | `dueDate: null`, `isOverdue: false` (FR-022) |

`401` y `404` de esta ruta siguen cubiertos por `show_task.spec.ts` (sin cambios de comportamiento).

**`backend/tests/functional/tasks/show_task.spec.ts`** (existente, actualización explícita **antes** de implementar, [research.md §8](../research.md#8-el-test-existente-show_taskspects-cambia-y-por-qué-no-es-editar-un-test-para-que-pase)):

- `expectedBody()` añade `dueDate: null` e `isOverdue: false` (las tareas de ese fichero no tienen fecha). Los 6 tests de camino feliz siguen asertando el cuerpo completo.
- «El detalle coincide con la fila de esa tarea en la lista» pasa a `assert.deepEqual(response.body().data, { ...listed, dueDate: null, isOverdue: false })`: las dos claves nuevas son las **únicas** diferencias permitidas.
- Los tests de `401` y `404` no cambian.

Regresión: `create_task.spec.ts`, `list_tasks.spec.ts` y `update_task_status.spec.ts` siguen en verde **sin editarse**.
