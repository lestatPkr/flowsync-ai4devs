# Contract: `GET /api/v1/tasks` con `status` (cambio aditivo)

Cubre la User Story 1 (FR-001 a FR-011) en el lado del servidor. Es la ruta de E2-1 (`specs/001-crear-tarea/`), **sin cambio de path, verbo ni forma de respuesta**: sigue devolviendo `{ data: Task[] }` con cada fila de `TaskTransformer`, en el mismo orden. Este cambio le añade:

1. un parámetro de consulta **opcional** `status`, y
2. un cambio de comportamiento deliberado **sin** `status`: las tareas en `done` dejan de incluirse (RF-21, FR-001). Sustituye `specs/002-cambiar-estado/` FR-013.

Controlador: `TasksController.index`. Validador: `listTasksValidator` (`app/validators/task.ts`). Transformer: `TaskTransformer` (sin cambios). Sigue dentro del grupo `tasks` con `middleware.auth()`.

Orden de evaluación: **sesión** (`401`) → **`status`** (`422`) → lectura (`200`). No hay `404`: es una colección.

## Request

```
GET /api/v1/tasks?status=in_progress
Authorization: Bearer <token>
Accept: application/json
```

| Parte | Regla |
|---|---|
| Query `status` | **Opcional.** Exactamente uno de `pending`, `in_progress`, `done`, sensible a mayúsculas. Ausente → vista por defecto (`pending` + `in_progress`). Presente con cualquier otro valor —vacío (`?status=`), desconocido (`archivada`, `all`), otra caja (`PENDING`), etiqueta en castellano (`Pendiente`) o repetido (`?status=pending&status=done`)— → `422`. Solo se lee de la query. |
| Otras claves de la query | Se **ignoran** (`assigneeId`, `dueDate`, `today`, …): no filtran nada (FR-011, [research §4](../research.md#4-cualquier-otro-parámetro-se-ignora-fr-011)). |
| Cuerpo | No se lee. |

## Respuesta — éxito (200)

Misma forma que antes. Filas ordenadas por `createdAt` desc, `id` desc.

```json
{
  "data": [
    {
      "id": 14,
      "title": "Revisar el PR de auth",
      "status": "in_progress",
      "createdAt": "2026-09-29T08:12:03.000+00:00",
      "assignee": { "id": 3, "fullName": "Ana Ruiz", "initials": "AR" }
    }
  ]
}
```

| Petición | `data` |
|---|---|
| sin `status` | todas las `pending` y todas las `in_progress`; **ninguna** `done` |
| `status=pending` / `in_progress` / `done` | todas las de ese estado y ninguna de otro |
| estado válido sin coincidencias | `[]` — **no** es un error (FR-004) |

**Saber si el espacio está vacío** (FR-008): la vista por defecto y `status=done` son una partición; el espacio no tiene tareas si y solo si ambas devuelven `[]` ([research §5](../research.md#5-saber-si-el-espacio-está-vacío-fr-008-us1-11-sin-cambiar-la-forma-de-la-respuesta)).

## Respuesta — filtro no válido (422)

La forma de VineJS que ya usa toda la API (FR-006). Nunca trae `data` (FR-005).

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

`field: "status"` señala el parámetro; `meta.choices` indica los tres válidos (CA-10). Es idéntico al `INVALID_STATUS_ERROR` de `update_task_status.spec.ts`. El texto en castellano lo genera `frontend/src/lib/api.ts` (`rule: 'enum'` → «Ese estado no es válido. Elige Pendiente, En curso o Hecho.»). El `422` prevalece aunque el espacio no tenga tareas (Edge Cases).

## Respuesta — sin sesión (401)

Sin cambios. Con o sin `status`, válido o no: `{ "errors": [{ "message": "Unauthorized access" }] }` y ninguna tarea (US1-12, FR-010).

## Matriz de comportamiento (Definition of Done)

Fichero **nuevo** `backend/tests/functional/tasks/list_tasks_by_status.spec.ts`, grupo `Tasks list by status (GET /api/v1/tasks?status=)`, aislado con `testUtils.db().truncate()`. Escrito y ejecutado en **rojo** antes del validador y del controlador. Cada test se titula como su escenario de la spec. Las respuestas `200` se asertan con `assert.deepEqual(response.body(), { data: [...] })` sobre la forma completa y el orden de todas las filas, con `createdAt` tomado del detalle `GET /api/v1/tasks/:id` de cada tarea (no de la lista que se está probando); las `422` y `401`, con `deepEqual` sobre el cuerpo entero.

Fixture común: Oscar y Ana; tareas de ambos en los tres estados (al menos dos por estado, para que «todas» no se confunda con «una»).

| # | Escenario (spec) | Petición | Esperado |
|---|---|---|---|
| 1 | US1-1 — sin estado: todas las pendientes y en curso, ninguna hecha | `GET /tasks` | `200`, exactamente las `pending` + `in_progress`, en orden; ninguna `done` |
| 2 | US1-2 — «Pendiente»: todas las pendientes, ninguna en curso ni hecha | `?status=pending` | `200`, exactamente las `pending` |
| 3 | US1-3 — «En curso» | `?status=in_progress` | `200`, exactamente las `in_progress` |
| 4 | US1-4 — «Hecho»: todas las hechas, que la lista sin filtro no incluye | `?status=done` y `GET /tasks` | `200`, exactamente las `done`; ninguna de ellas en la lista sin filtro |
| 5 | US1-5 — estado válido sin tareas: lista vacía, no un error | `?status=in_progress` sin tareas en curso | `200`, `{ data: [] }` |
| 6 | US1-6 — estado que no es ninguno de los tres ({status}) se rechaza y no devuelve lista | dataset `archivada`, `all`, `Pendiente`, `PENDING`, `''` | `422`, cuerpo = `INVALID_STATUS_ERROR`, sin `data` |
| 7 | US1-7 — el rechazo señala el estado, da los válidos y no se confunde con un filtro sin resultados | `?status=archivada` y `?status=in_progress` (vacío) sobre el mismo espacio | `422` con `field: 'status'` y `meta.choices` vs `200` con `[]`: códigos y cuerpos distintos |
| 8 | US1-8 — mezclar las hechas con el resto se rechaza ({case}) | dataset `?status=pending&status=done`, `?status=todas`, `?status=pending,done` | `422`, cuerpo = `INVALID_STATUS_ERROR` |
| 9 | US1-9 — pasar a «Hecho» la saca de la lista sin filtro y la pone en «Hecho»; devolverla la trae de vuelta | `PATCH …/status` `done` → `GET /tasks` y `?status=done`; `PATCH` `pending` → las dos otra vez | fuera / dentro; y al revés |
| 10 | US1-10 — pedir la lista, con cualquier filtro, válido o no, no modifica ninguna tarea | varias `GET` (sin, cada estado, `archivada`, `''`, `401`) | `status`, `title`, `assigneeId`, `dueDate` y `updated_at` (retrasado antes a un instante fijo) de todas las tareas, idénticos en BD |
| 11 | US1-11 — una lista vacía permite saber si el espacio no tiene tareas o si ninguna encaja | espacio vacío; y espacio con solo tareas `done` | vacío: `GET /tasks` = `[]` **y** `?status=done` = `[]`; todo hecho: `GET /tasks` = `[]` **y** `?status=done` ≠ `[]` |
| 12 | US1-12 — sin sesión no recibe ninguna tarea, con o sin filtro ({case}) | dataset sin query, `done`, `archivada`; sin token y con token inválido | `401`, cuerpo = `UNAUTHORIZED_ERROR` (el `401` va antes que el `422`) |
| 13 | Edge — en un espacio sin tareas, un filtro no válido se sigue rechazando | espacio vacío, `?status=archivada` | `422`, no `200 []` |
| 14 | FR-011 — el estado es la única dimensión: cualquier otro parámetro no filtra | `?assigneeId=<ana>`, `?today=2026-09-29` | `200`, idéntico a `GET /tasks` sin query |
| 15 | Assumptions — la lista filtrada mantiene el orden de la lista | tres `pending` creadas en orden | `?status=pending` en `createdAt` desc, `id` desc |

`404`: no aplica (colección). Tests existentes: `list_tasks.spec.ts` sigue en verde **sin editarse**; los helpers de tres ficheros cambian antes de implementar ([research §6](../research.md#6-tests-existentes-que-leen-createdat-de-la-lista-sin-filtro)).
