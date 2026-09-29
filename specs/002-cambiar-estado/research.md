# Research: Cambiar el estado de una tarea desde la lista

Phase 0 de `/speckit-plan`. Cada decisión se ha contrastado contra el código real del repo y los `.d.ts`/fuentes de `backend/node_modules/` (AdonisJS 7, Lucid 22, VineJS 4.4), no contra documentación de versiones anteriores.

## 1. Endpoint y controlador

- **Decision**: `PATCH /api/v1/tasks/:id/status`, cuerpo `{ "status": "<valor>" }`, atendido por un controlador nuevo `app/controllers/task_statuses_controller.ts` con una única acción `update`. La ruta se declara **dentro** del grupo `tasks` existente de `start/routes.ts` (el que ya tiene `.prefix('tasks').as('tasks').use(middleware.auth())`), como `router.patch(':id/status', [controllers.TaskStatuses, 'update'])`. Nombre de ruta resultante: `tasks.task_statuses.update`. Las dos rutas existentes del grupo no cambian.
- **Rationale**: el estado se modela como sub-recurso de la tarea (`/tasks/:id/status`), lo que deja libre `PATCH /tasks/:id` para la edición general de E2-6/E2-7 sin tener que decidir hoy su forma. Un controlador propio mantiene `tasks_controller.ts` en CRUD de la colección y sigue la convención de AdonisJS de «un controlador por recurso». Colgarlo del grupo existente hereda `middleware.auth()` sin duplicarlo, que es lo que exige BOUNDARIES.md para rutas nuevas.
- **Alternatives considered**:
  - `PATCH /api/v1/tasks/:id` con `{ status }` en `TasksController.update` — ocupa prematuramente el endpoint de edición general y engorda `tasks_controller.ts`.
  - `POST /api/v1/tasks/:id/status` — el cambio es idempotente (mismo cuerpo, mismo resultado), así que `PATCH` describe mejor la semántica; CORS ya admite `PATCH` (`config/cors.ts`, `methods` incluye `'PATCH'`).
  - Un grupo de rutas nuevo para `tasks/:id` — duplicaría el `middleware.auth()` y abriría la puerta a olvidarlo.

## 2. Validador y orden validación → búsqueda

- **Decision**: en `app/validators/task.ts`, junto a `createTaskValidator`:
  `export const updateTaskStatusValidator = vine.create({ status: vine.enum(TASK_STATUSES) })`, importando `TASK_STATUSES` de `#models/task` (única fuente de verdad de los tres valores; no se repiten literales). El controlador **valida primero** y **busca después**: `request.validateUsing(updateTaskStatusValidator)` → `Task.findOrFail(params.id)`.
- **Rationale**: `vine.enum` admite un `readonly` array (`enum<const Values extends readonly unknown[]>` en `builder.d.ts`), así que `TASK_STATUSES` (`as const`) tipa `status` como `TaskStatus` sin casts. Errores que produce VineJS 4.4 (verificado en `build/src/defaults.js` e `index.js`):
  - valor fuera del catálogo → `{ message: 'The selected status is invalid', rule: 'enum', field: 'status', meta: { choices: ['pending', 'in_progress', 'done'] } }`
  - clave ausente → `{ message: 'The status field must be defined', rule: 'required', field: 'status' }`
  Validar antes de tocar la BD es el orden habitual en el repo (`TasksController.store`) y evita una consulta inútil. Consecuencia documentada en el contrato: un cuerpo inválido sobre un id inexistente responde `422`, no `404`. Desde la interfaz nunca se envía un estado inválido, así que para el usuario el aviso de «ya no existe» siempre llega.
  El validador solo declara `status`: cualquier otra clave del cuerpo (`title`, `assigneeId`…) no llega a `validateUsing` y por tanto no se persiste (FR-004).
- **Alternatives considered**:
  - `vine.string().in([...])` — en VineJS 4 la regla de catálogo es `vine.enum`; repetir los literales rompería la fuente única.
  - Buscar primero y validar después (`404` antes que `422`) — una consulta más por petición inválida sin ganancia para el usuario.
  - Validar también `params.id` con VineJS — añade complejidad sin cambiar el resultado (ver §4).

## 3. Forma determinista del `404`

- **Decision**: `Task.findOrFail(params.id)` lanza `E_ROW_NOT_FOUND` (Lucid, `status = 404`, `message = 'Row not found'`). En `app/exceptions/handler.ts`, `handle()` intercepta esa excepción (`error instanceof lucidErrors.E_ROW_NOT_FOUND`, con `import { errors as lucidErrors } from '@adonisjs/lucid'`) y responde `ctx.response.status(404).send({ errors: [{ message: 'Row not found' }] })`; el resto de errores sigue en `super.handle`.
- **Rationale**: sin esa rama, el `ExceptionHandler` de `@adonisjs/http-server` renderiza el `404` con `renderErrorAsJSON`, que **en modo debug** (dev y test: `debug = !app.inProduction`) envía el volcado de Youch con la traza, y en producción `{ message: 'Row not found' }`. Esa forma cambia según entorno y contiene rutas de disco: no se puede asertar como «forma completa» (Principio II v1.1.0) y además filtraría detalles internos. Con la rama, el `404` tiene la misma forma `{ errors: [{ message }] }` que ya usan el `401` de `middleware.auth()` y el `422` de VineJS, en todos los entornos. `handler.ts` no está en la zona vallada, y la rama no altera ninguna ruta existente: ninguna usa hoy `findOrFail`/`firstOrFail` (`grep` sobre `backend/app` y `backend/start`, sin resultados).
- **Alternatives considered**:
  - `Task.find()` + `response.notFound(...)` en el controlador — funciona, pero contradice la restricción del input (`Task.findOrFail`) y obliga a repetirlo en cada endpoint futuro que busque por id (E2-5, E2-6, E2-7, E2-10).
  - Asertar solo `404` y un campo suelto — prohibido por la matriz de la constitución.
  - Mapear todos los `404` (incluido `E_ROUTE_NOT_FOUND`) — cambia la forma de respuesta de rutas inexistentes, fuera de alcance.

## 4. Id no numérico en la URL

- **Decision**: la ruta **no** lleva matcher (`router.matchers.number()`). `PATCH /api/v1/tasks/abc/status` llega al controlador, `Task.findOrFail('abc')` no encuentra fila en SQLite y responde el mismo `404` de §3. Se incluye en la matriz de tests.
- **Rationale**: con matcher, un id no numérico no casa ninguna ruta y cae en `E_ROUTE_NOT_FOUND`, cuyo cuerpo en debug vuelve a ser Youch (el problema de §3) y no se tocaría. Sin matcher hay un único camino de «no existe», determinista y ya cubierto.
- **Alternatives considered**: matcher numérico + mapear `E_ROUTE_NOT_FOUND` — más superficie y un cambio de comportamiento global no pedido.

## 5. Persistencia, mismo estado y concurrencia

- **Decision**: `task.merge({ status }).save()`, luego `await task.load('assignee')` y `return serialize(TaskTransformer.transform(task))` con `200`. Elegir el estado que la tarea ya tiene responde `200` con la tarea tal cual (mismo `status`, `title` y `assignee`); no se añade ninguna rama especial para ese caso. Sin bloqueo optimista ni comprobación de versión: gana el último en guardarse.
- **Rationale**: la spec pide que «mismo estado» no sea un error (Edge Cases) y que la concurrencia sea *last write wins* sin aviso (Assumptions). `updated_at` ya existe con `autoUpdate` en `TaskSchema` y se actualiza solo; el `TaskTransformer` no lo expone y no se cambia (la forma de respuesta de `GET`/`POST /tasks` sigue idéntica). `title` y `assigneeId` no se tocan: el controlador solo asigna `status` (FR-004).
- **Alternatives considered**: `Task.query().where('id', id).update({ status })` — ahorra una lectura pero pierde el `404` de `findOrFail`, el `autoUpdate` de `updatedAt` y la instancia para el transformer.

## 6. Control de estado en la fila

- **Decision**: un `<select>` **nativo** en cada fila, con las tres opciones fijas en el orden `Pendiente`, `En curso`, `Hecho` (etiquetas del `STATUS_LABELS` que ya existe en `task-list.tsx`, valores `pending`/`in_progress`/`done`). Se estiliza con las mismas clases base de `ui/input.tsx` (`h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs` + los estados `focus-visible:*` y `aria-invalid:*`) ajustado a ancho automático; sustituye a la píldora de estado actual. Nombre accesible por fila: `aria-label="Estado de «{título}»"`. Vive en un componente nuevo `components/tasks/task-status-select.tsx` que `task-list.tsx` pinta en cada fila. Detalle en [contracts/task-status-ui.md](./contracts/task-status-ui.md).
- **Rationale**:
  - **2 interacciones** (FR-002, SC-001): con ratón, abrir el desplegable + elegir; con teclado, `Tab` hasta el control y flechas (o abrir con `Espacio`/`Alt+↓` y confirmar con `Enter`). Sin diálogo ni campos (FR-001).
  - **Catálogo cerrado visible** (FR-005, CA-3): el control solo puede ofrecer esas tres opciones; no hay forma de escribir otro valor.
  - **Teclado y lectores de pantalla** (FR-015): el `<select>` nativo trae de serie foco, navegación por flechas y anuncio del valor, sin reimplementarlo.
  - **Sin dependencias ni componentes generados nuevos** (R-3, R-8): no hay `Select` en `ui/`; traerlo con `npx shadcn add select` añadiría `@radix-ui/react-select` a `package.json`, que BOUNDARIES.md prohíbe sin aprobación. Reutilizar las clases de `Input` mantiene el mismo borde, radio, foco y tema oscuro.
  - Extraer el componente es obligado: cada fila necesita estado propio (§7) y los hooks no pueden declararse dentro del `map`.
- **Alternatives considered**:
  - Tres botones segmentados por fila — 1 interacción, pero triplica los puntos de tabulación por fila y ocupa el ancho que hoy usan título y responsable.
  - Botón que cicla al siguiente estado — la vuelta atrás desde «Hecho» o el salto «Pendiente → Hecho» costaría más de 2 interacciones (incumple FR-002/FR-006).
  - Menú desplegable propio con `Button` + lista — hay que reimplementar accesibilidad de teclado que el nativo ya da.

## 7. Reflejo inmediato y reconciliación de la fila

- **Decision**: actualización **optimista con reconciliación**, serializada por fila:
  1. Al elegir un estado, el `<select>` muestra ya el elegido y se envía `PATCH`.
  2. Si llega `200`, la fila se sustituye por la tarea devuelta (`onTaskUpdated(task)` → `TasksPage` reemplaza por `id` en su array, sin reordenar ni recargar).
  3. Si falla (cualquier `ApiError`: `422`, `404`, `401`, red, `5xx`), el control vuelve a mostrar el **último estado confirmado por el servidor** (el de la prop `task`) y aparece el mensaje bajo la fila.
  4. Mientras hay una petición en vuelo en esa fila, un nuevo cambio **no** lanza otra petición en paralelo: se guarda como «pendiente» (solo el último) y se envía cuando termina la anterior, si difiere de lo confirmado. El control no se deshabilita.
- **Rationale**: FR-011/SC-002 (<1 s, sin recargar) se cumplen porque el valor elegido se ve en el acto. FR-012/SC-005 (nunca mostrar como guardado lo que no se guardó) se cumplen porque el valor optimista solo sobrevive si el servidor lo confirma, y en error se vuelve a la última verdad conocida. Serializar por fila garantiza el Edge Case «varios cambios seguidos»: sin serializar, dos `PATCH` en paralelo pueden llegar desordenados y la BD acabaría en un estado distinto del último elegido (p. ej. al recorrer opciones con las flechas en un `<select>` cerrado, que en Chrome/Windows dispara `change` en cada pulsación). No deshabilitar el control evita que el navegador le quite el foco a mitad de uso con teclado (FR-015). Reemplazar por `id` en el array de `TasksPage` deja intactas las demás filas, el scroll y el texto del formulario de creación (FR-014). La tarea en «Hecho» sigue en la lista (FR-013): no se filtra nada.
- **Alternatives considered**:
  - Pesimista (esperar al `200` para mostrar el cambio) — correcto, pero el control «rebota» al valor anterior durante la petición, lo que parece un fallo.
  - Deshabilitar el `<select>` mientras hay petición — el navegador le quita el foco y el usuario de teclado pierde su sitio.
  - «La última respuesta gana» con un contador de peticiones, sin serializar — arregla la vista pero no el orden de llegada al servidor: la fila y la BD podrían discrepar.
  - Recargar la lista (`listTasks`) tras cada cambio — resetea la vista y cuesta una petición más por gesto.

## 8. Mensajes en castellano y cambios en `lib/api.ts`

- **Decision**: todo en `frontend/src/lib/api.ts` (único punto de contacto con el backend):
  - `RequestOptions.method` pasa a `'GET' | 'POST' | 'PATCH'`.
  - `export function updateTaskStatus(id: number, status: TaskStatus, token: string): Promise<Task>` → `PATCH /api/v1/tasks/${id}/status` con `{ status }`, desenvuelve `data`. Si el error es `404`, lo relanza con el mensaje de tarea inexistente.
  - `FIELD_LABELS.status = 'el estado'` y una rama `case 'enum'` en `translate()`.
  - Textos (tono y forma de los existentes):

    | Caso | Origen | Mensaje |
    |---|---|---|
    | Estado fuera del catálogo | `422`, `rule: 'enum'` | «Ese estado no es válido. Elige Pendiente, En curso o Hecho.» |
    | Estado ausente | `422`, `rule: 'required'` | «Falta rellenar el estado.» (rama `required` ya existente + label nuevo) |
    | Tarea inexistente | `404` | «Esta tarea ya no existe: puede que alguien la haya borrado. Recarga la página para ver la lista al día.» |
    | Sesión caducada | `401` | «Tu sesión ha caducado. Vuelve a iniciar sesión.» (ya existente) |
    | Sin conexión | `fetch` falla | «No se pudo conectar con el servidor. Comprueba que el backend está arrancado.» (ya existente) |
    | Error de servidor | `5xx` u otro | «Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» (ya existente) |

- **Rationale**: la spec exige mensajes comprensibles, distinguibles entre sí (el de «ya no existe» no se puede confundir con uno de conexión ni con uno de estado no válido) y sin errores técnicos crudos (FR-008, FR-009, FR-012). Hoy `toApiError` convertiría un `404` en el genérico de servidor, que es justo la confusión que la spec prohíbe. El mensaje de `404` se fija en `updateTaskStatus` y no como rama genérica de `toApiError` porque es el único endpoint que puede responder `404` y el texto habla de «tarea»; cuando E2-5/E2-6 añadan más, se generaliza.
- **Alternatives considered**: construir los mensajes en el componente — rompe la regla de `CLAUDE.md` de que la traducción de errores vive en `lib/api.ts`.

## 9. Tests: matriz, orden y aserción de forma completa

- **Decision**: fichero nuevo `backend/tests/functional/tasks/update_task_status.spec.ts`, un `test.group('Tasks status update (PATCH /api/v1/tasks/:id/status)')` con `group.each.setup(() => testUtils.db().truncate())`, escrito y ejecutado en **rojo** antes de tocar ruta, validador, controlador y handler. Casos: la matriz de [contracts/task-status-api.md](./contracts/task-status-api.md#matriz-de-comportamiento-definition-of-done). Las 6 transiciones van con el dataset de Japa (`test(...).with([...])`). Cada respuesta se compara con `assert.deepEqual(response.body(), …)` contra el **cuerpo entero** (en los `200`, `data` completo con `id`, `title`, `status`, `assignee{id, fullName, initials}` y `createdAt`; en los errores, el array `errors` exacto), y cada caso de error vuelve a leer la tarea de la BD para comprobar que conserva su estado. `createdAt` se compara con el valor que devuelve la propia API para esa tarea antes del cambio (`GET /api/v1/tasks` o la respuesta de un primer `PATCH`), no con una serialización hecha a mano, para no acoplar el test al formato de Luxon.
- **Rationale**: es literalmente la Definition of Done del Principio II v1.1.0: camino feliz + `422` + `401` + `404`, forma completa, test antes que código. El dataset evita seis tests copiados y documenta la decisión de producto que cierra PA-7. Releer la BD en los errores prueba «la tarea conserva el estado que tenía» (FR-008, SC-004), que el código de estado solo no garantiza.
- **Alternatives considered**: `assertBodyContains` como en `create_task.spec.ts` — es una aserción de subconjunto; la constitución v1.1.0 pide forma completa para lo nuevo (los tests existentes no se editan).

## 10. Código generado en `backend/.adonisjs/`

- **Decision**: no se edita a mano. Tras añadir controlador y ruta, correr `npm test` (o `npm run dev`) desde `backend/` regenera `.adonisjs/server/controllers.ts` (entrada `TaskStatuses`) y `.adonisjs/client/registry/` (ruta `tasks.task_statuses.update` con sus tipos de request/response). El diff se commitea en el mismo PR.
- **Rationale**: `start/routes.ts` resuelve controladores vía `#generated/controllers`, y `tests/bootstrap.ts` tipa el `apiClient` de Japa con el registro: sin regenerar, ni la ruta compila ni el test está tipado. `CLAUDE.md` exige commitearlo para que un clon limpio compile.

## 11. Autenticación y CORS

- **Decision**: ningún cambio. El `401` lo produce `middleware.auth()` del grupo (guard `api`), con cuerpo `{ errors: [{ message: 'Unauthorized access' }] }` (renderer JSON de `E_UNAUTHORIZED_ACCESS` en `@adonisjs/auth`). CORS ya permite `PATCH` con `headers: true` y `credentials: true`.
- **Rationale**: FR-010 pide reutilizar la autenticación sin modificarla; BOUNDARIES.md la valla. El frontend ya envía `Authorization: Bearer` desde `request()`. Qué hace la app con una sesión caducada más allá del mensaje (p. ej. volver a `/login`) pertenece a `frontend/src/auth/`, vallado, y no cambia aquí.
