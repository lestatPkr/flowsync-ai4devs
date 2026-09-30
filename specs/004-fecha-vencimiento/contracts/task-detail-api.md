# Contract: `GET /api/v1/tasks/:id` (cambios de FS-118)

Ruta **existente** (E2-5, [specs/003-abrir-tarea/contracts/task-detail-api.md](../../003-abrir-tarea/contracts/task-detail-api.md)). Path, verbo, nombre (`tasks.show`), controlador (`TasksController.show`) y ramas `401`/`404` **no cambian**. FS-118 le hace dos cambios:

1. **Acepta `?today=AAAA-MM-DD` opcional.** Sin él, la ruta responde como hoy, con los dos campos nuevos calculados con la fecha UTC del servidor.
2. **La respuesta gana `dueDate` e `isOverdue`.**

> ⚠️ **Pendiente de visto bueno humano.** Ambos cambios tocan la «forma de la respuesta» de una ruta pública existente, que `BOUNDARIES.md` prohíbe cambiar, y rompen las aserciones de cuerpo completo de `show_task.spec.ts`. Opciones y propuesta en [research.md §8](../research.md#8--impacto-sobre-get-apiv1tasksid-y-sus-tests-existentes) y en el Constitution Check del plan.

Cubre FR-003, FR-010 a FR-013 en el lado del servidor. Orden de evaluación: **sesión** (`401`) → **query** (`422` en `today`, nuevo) → **existencia** (`404`) → lectura (`200`).

## Request

```
GET /api/v1/tasks/12?today=2026-09-30
Authorization: Bearer <token>
Accept: application/json
```

| Parte | Regla |
|---|---|
| `:id` | Sin cambios: un valor no numérico se trata como tarea inexistente (`404`). |
| `today` (query, opcional) | `AAAA-MM-DD`: el día de hoy de quien mira. El frontend lo envía **siempre**, con la fecha local del navegador. **Si falta, el servidor usa su propia fecha en UTC.** Es una red de seguridad documentada, no el camino normal: sin `today`, alguien lejos de UTC puede ver durante unas horas una lectura distinta de la que tendría con su propio día. |
| Cuerpo / otras claves de la query | No se leen. |

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

| Campo nuevo | Valor |
|---|---|
| `dueDate` | `"AAAA-MM-DD"`, o `null` si la tarea no tiene fecha. La misma para cualquier `today`. |
| `isOverdue` | `Task.isOverdueOn(today)`: `true` si y solo si hay `dueDate`, es **estrictamente anterior** a `today` y `status` no es `done`. Se calcula en cada lectura y nunca se guarda. |

Los campos existentes (`id`, `title`, `status`, `assignee`, `createdAt`) no cambian de nombre, tipo ni valor.

## Respuesta — `today` mal formado (422, rama nueva)

```json
{ "errors": [{ "message": "The today field must be a datetime value", "rule": "date", "field": "today" }] }
```

Ningún dato de la tarea en el cuerpo.

## Respuestas `401` y `404`

Sin cambios: ver el contrato de E2-5.

## Lo que NO cambia: la lista

`GET /api/v1/tasks` (`TaskTransformer`) **no** lleva `dueDate` ni `isOverdue` en ninguna tarea (FR-015, CA-11), y `PATCH /api/v1/tasks/:id/status` tampoco, porque usa el mismo transformer de la lista.

## Matriz de la regla (Definition of Done)

En `backend/tests/functional/tasks/task_overdue.spec.ts`, escritos y ejecutados **en rojo** antes que la implementación. `today` siempre explícito salvo en el caso #9. Cuerpo completo con `deepEqual`.

| # | Borde | Tarea | `today` | `isOverdue` esperado |
|---|---|---|---|---|
| 1 | Día anterior | `pending`, `dueDate: 2026-09-29` | `2026-09-30` | **true** |
| 2 | Mismo día | `pending`, `dueDate: 2026-09-30` | `2026-09-30` | false |
| 3 | Día posterior | `pending`, `dueDate: 2026-10-01` | `2026-09-30` | false |
| 4 | Sin fecha | `pending`, `dueDate: null`, creada hace semanas | `2026-09-30` | false |
| 5 | Hecha con fecha pasada | `done`, `dueDate: 2026-09-01` | `2026-09-30` | false; `dueDate` intacta |
| 6 | `in_progress` con fecha pasada | `in_progress`, `dueDate: 2026-09-29` | `2026-09-30` | **true** |
| 7 | Dos husos | `pending`, `dueDate: 2026-09-29` | `2026-09-29` y `2026-09-30` sobre la misma tarea | false y **true**, las dos correctas |
| 8 | Vence sola | `pending`, `dueDate: 2026-09-30` | `2026-09-30` y luego `2026-10-01`, sin modificar la tarea entre medias | false y luego **true**; `updated_at` sin cambios |
| 9 | Sin `today` → UTC | `pending`, `dueDate` = ayer en UTC | sin query | **true** (el test calcula el día UTC con `DateTime.utc()`) |
| 10 | Vuelta desde `done` | `done` con `dueDate: 2026-09-29`, se pasa a `pending` con `PATCH /status` | `2026-09-30` | **true** |
| 11 | Pasar a `done` no toca la fecha | `pending` con `2026-09-29`, se pasa a `done` con `PATCH /status` | `2026-09-30` | false; `dueDate: '2026-09-29'` igual |
| 12 | `422` `today` imposible | cualquiera | `2026-02-31` | `422`, cuerpo completo en `today` |
| 13 | `422` `today` formato ajeno | cualquiera | `30/09/2026` | `422`, mismo cuerpo |

Más, en `list_tasks.spec.ts`, un test **nuevo** (sin editar los existentes): con tareas sin fecha, con fecha futura y vencidas, ninguna fila de `GET /api/v1/tasks` tiene las claves `dueDate` ni `isOverdue`, y cada fila tiene exactamente las claves `id`, `title`, `status`, `assignee`, `createdAt`.
