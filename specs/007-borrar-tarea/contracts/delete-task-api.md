# Contract: `DELETE /api/v1/tasks/:id`

Cubre, en el lado del servidor, FR-001, FR-005, FR-013, FR-014, FR-017 a FR-019 y FR-021 a FR-023, y las mitigaciones R1–R4, R6 (la parte del API), R7, R9 y R10 del [modelo de amenazas](../../../docs/security/threat-model-e2-10.md). Vive **dentro** del grupo `tasks` existente de `backend/start/routes.ts`, protegido por `middleware.auth()` (guard `api`). Nombre de ruta: `tasks.destroy`. Controlador: `TasksController.destroy`. Ninguna otra ruta cambia (path, verbo ni forma de respuesta): `GET`/`POST /api/v1/tasks`, `GET /api/v1/tasks/:id`, `PATCH /api/v1/tasks/:id/status`, `PUT /api/v1/tasks/:id/due-date`, `/auth/*` y `/account/*` siguen igual.

Orden de evaluación: **sesión** (`401`) → **forma del id** (`404`) → **existencia** (`404`) → borrado (`204`). No hay cuerpo ni query que validar: **no existe rama `422`**.

## Request

```
DELETE /api/v1/tasks/12
Authorization: Bearer <token>
Accept: application/json
```

| Parte | Regla |
|---|---|
| `:id` | Entero positivo en forma canónica: `/^[1-9]\d*$/` y `Number.isSafeInteger`. Cualquier otra forma (`abc`, `-1`, `0`, `01`, `1.0`, `1e0`, ` 1`, `1 OR 1=1`, `1,2`) se responde como tarea inexistente, sin consultar la BD ([research §2](../research.md#2-el-id-se-valida-en-forma-canónica-no-se-interpreta)). |
| Cuerpo | No se lee. Un cuerpo con otros ids no cambia nada: se borra solo `:id`. |
| Query | No se lee. `?token=` no autentica. |
| Credencial | Solo `Authorization: Bearer`. Ni cookie, ni query, ni sesión del guard `web`. |

CORS: `DELETE` está en `methods` de `backend/config/cors.ts` y `headers: true` refleja `Authorization`; **no se cambia** ([research §6](../research.md#6-cors-delete-ya-está-permitido)).

## Respuesta — borrada (204)

Sin cuerpo (`response.noContent()`, no pasa por `serialize()`):

```
HTTP/1.1 204 No Content
X-Frame-Options: DENY
```

- Borra la fila de `tasks` de verdad: después no está en la tabla ni en `GET /api/v1/tasks` (vista por defecto ni `?status=…`), y `GET /api/v1/tasks/:id` responde `404`.
- Exactamente una fila: con N tareas quedan N−1, y las demás no cambian.
- Igual para cualquier miembro autenticado, sea o no el responsable (R10).
- No guarda ni registra quién borró (R9).

## Respuesta — sin sesión (401)

Sin `Authorization`, con un token inventado o revocado, o con la credencial por otra vía. Comportamiento heredado de `middleware.auth()`, sin cambios:

```json
{ "errors": [{ "message": "Unauthorized access" }] }
```

No se borra nada. Ningún dato de la tarea en el cuerpo.

## Respuesta — la tarea no existe (404)

Id que nunca existió, tarea ya borrada (incluido borrar dos veces) o id que no está en forma canónica. `E_ROW_NOT_FOUND`, renderizado por `app/exceptions/handler.ts` (**sin cambios**) con forma fija en todos los entornos:

```json
{ "errors": [{ "message": "Row not found" }] }
```

Sin traza, sin SQL, sin datos de la tarea y sin indicación de quién la borró (R7).

## Fuera del endpoint: la colección no se borra

`DELETE /api/v1/tasks` (sin id, con o sin query) **no existe**: el router responde `404` y no se borra nada (R3). El cuerpo de ese `404` lo da el router y este cambio no lo fija.

## Matriz de comportamiento (Definition of Done)

Principio II v1.2.0. Todos en `backend/tests/functional/tasks/delete_task.spec.ts`, **escritos y ejecutados en rojo antes** que la ruta y la acción. Aislados con `testUtils.db().truncate()`.

- «Cuerpo completo» = `assert.deepEqual(response.body(), …)` sobre el cuerpo entero; en el `204`, `response.text()` es `''`.
- «Intacta» = releer la tarea y comprobar `title`, `status`, `assigneeId`, `dueDate` y `updatedAt` sin cambios.
- «Recuento» = número de filas de `tasks` antes y después.
- Los ids manipulados se construyen a partir del id real de la tarea creada (p. ej. `` `0${task.id}` ``), nunca con números fijos.

| # | Rama | Preparación | Petición | Esperado |
|---|---|---|---|---|
| 1 | Feliz, tarea propia | Tarea de Oscar | Oscar: `DELETE /tasks/:id` | `204`, cuerpo vacío; la fila ya no está en `tasks` (`Task.find` → `null`) |
| 2 | Feliz, tarea ajena (R10) | Tarea creada y llevada por Ana | Oscar la borra | `204`, cuerpo vacío; la fila ya no está |
| 3 | Feliz, una entre varias (R3) | N = 3 tareas | Oscar borra la del medio | `204`; recuento N−1; las otras dos intactas |
| 4 | Feliz, cualquier estado y con fecha | Tarea en `done` con `dueDate` | `DELETE` | `204`; la fila ya no está |
| 5 | Ya no aparece en la lista (CA-2) | Tarea de Ana en `pending` y otra en `done`; Oscar borra ambas | Ana: `GET /api/v1/tasks` y `GET /api/v1/tasks?status=done` | `200`, ninguna de las dos en `data` (cuerpo completo con las que quedan) |
| 6 | Ya no se puede abrir | Tarea borrada con un primer `DELETE` por la API (`204`), no con `task.delete()`: si no, la fila nace en verde | `GET /api/v1/tasks/:id` | `404`, `{ errors: [{ message: 'Row not found' }] }` |
| 7 | El cuerpo no amplía el borrado (R3) | Tareas A, B, C | `DELETE /tasks/:A` con cuerpo `{ ids: [B, C] }` | `204`; solo A borrada; B y C intactas |
| 8 | `401` sin sesión (R1) | Tarea de Oscar | Sin `Authorization` | `401`, `{ errors: [{ message: 'Unauthorized access' }] }`; intacta |
| 9 | `401` token inventado (R1) | Tarea de Oscar | `Authorization: Bearer oat_no-es-un-token` | `401`, mismo cuerpo; intacta |
| 10 | `401` token revocado (R1) | Oscar hace login y luego `POST /account/logout` con ese token | `DELETE` con el token revocado | `401`, mismo cuerpo; intacta |
| 11 | `401` token en la query (R2) | Token válido de Oscar | `DELETE /tasks/:id?token=<token>` sin cabecera | `401`, mismo cuerpo; intacta |
| 12 | `401` token en una cookie (R2) | Token válido de Oscar | Cabecera `Cookie: token=<token>`, sin `Authorization` | `401`, mismo cuerpo; intacta |
| 13 | `401` sesión del guard `web` (R2) | Oscar | `.withGuard('web').loginAs(oscar)` | `401`, mismo cuerpo; intacta |
| 14 | `404` id inexistente | BD sin esa tarea | `DELETE /tasks/<id real + 1000>` | `404`, `{ errors: [{ message: 'Row not found' }] }`; recuento igual |
| 15 | `404` id no numérico | Una tarea | `DELETE /tasks/abc` | `404`, mismo cuerpo; intacta |
| 16 | `404` borrar dos veces (R8) | Tarea borrada con un primer `DELETE` (`204`) | Segundo `DELETE` igual | `404`, mismo cuerpo |
| 17 | `404` id con otra forma que casaría en SQLite (R4) | Tarea T y otra U | `DELETE` con `0${T}`, `${T}.0`, `${T}e0`, `%20${T}` | `404`, mismo cuerpo en los cuatro; T y U intactas; recuento igual |
| 18 | `404` id negativo, cero, compuesto o con SQL (R4) | Tareas T y U | `-${T}`, `0`, `${T},${U}`, `${T}%20OR%201=1` | `404`, mismo cuerpo en todos; T y U intactas; recuento igual |
| 19 | Sin colección (R3) | N = 3 tareas | `DELETE /api/v1/tasks` y `DELETE /api/v1/tasks?status=pending`, con sesión | `404`; recuento sigue N (el cuerpo es del router: no se asserta) |
| 20 | Sin fugas (R7) | Tarea de Ana | Oscar la borra; luego la vuelve a borrar | `204` sin cuerpo; el `404` es exactamente `{ errors: [{ message: 'Row not found' }] }` (sin `stack`, sin nombres, sin `data`) |
| 21 | No se puede incrustar (R6, API) | Tarea de Oscar | `DELETE` | `204` con cabecera `x-frame-options: DENY` |
| — | `422` | No aplica | El endpoint no recibe cuerpo ni query; un `:id` inválido es `404` (#15, #17, #18) | — |

**Revisión del diff (R9)**, no automatizable en Japa: ninguna migración nueva, ninguna columna `deleted_*`, ningún `logger.*` en `TasksController.destroy`.

Regresión: las suites existentes de `backend/tests/functional/` siguen en verde **sin editarse**; la cobertura de `backend/app/` no baja (la acción nueva queda ejercitada entera por la matriz, incluida la rama de forma de id).
