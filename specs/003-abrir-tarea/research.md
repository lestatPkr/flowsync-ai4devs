# Research: Abrir una tarea de la lista

Phase 0 de `/speckit-plan`. Cada decisión se ha contrastado contra el código real del repo (lo que dejaron E2-1 y E2-4) y contra los `.d.ts` de `node_modules/` (AdonisJS 7, Lucid 22, react-router 8.3), no contra documentación de versiones anteriores.

## 1. Endpoint y acción

- **Decision**: `GET /api/v1/tasks/:id`, acción `show` de `app/controllers/tasks_controller.ts`. La ruta se declara **dentro** del grupo `tasks` existente de `start/routes.ts` (`.prefix('tasks').as('tasks').use(middleware.auth())`) como `router.get(':id', [controllers.Tasks, 'show'])`. Nombre de ruta resultante: `tasks.show`. La acción: `Task.findOrFail(params.id)` → `await task.load('assignee')` → `return serialize(TaskDetailTransformer.transform(task))`, con `200`. Las tres rutas existentes del grupo (`GET /`, `POST /`, `PATCH :id/status`) no cambian.
- **Rationale**: leer una tarea es la acción `show` del propio recurso `tasks`, que ya atiende `TasksController` (`index`, `store`). El cambio de estado se llevó a `TaskStatusesController` por ser un sub-recurso (`/tasks/:id/status`); leer la tarea no lo es. Colgarla del grupo hereda `middleware.auth()` sin duplicarlo, que es lo que BOUNDARIES.md exige para rutas nuevas. `GET /` y `GET :id` no colisionan (el segundo exige un segmento), y `:id` no casa `:id/status` (segmentos distintos). `findOrFail` + `load` en vez de `Task.query().where('id', …).preload('assignee').firstOrFail()`: mismo número de consultas (2), y mismo patrón que `TaskStatusesController.update`.
- **Alternatives considered**:
  - Un controlador propio (`TaskDetailsController.show`) — separa lo que en AdonisJS es la misma entidad y engorda `.adonisjs/server/controllers.ts` sin ganancia.
  - Filtrar la lista en el frontend (`listTasks()` + `find`) — no hay vista con dirección propia que sobreviva a recargar (FR-012), no se puede distinguir «ya no existe» de verdad, y descarga todas las tareas para ver una.

## 2. Transformer propio del detalle

- **Decision**: `app/transformers/task_detail_transformer.ts`, clase `TaskDetailTransformer extends BaseTransformer<Task>`, con un `toObject()` que devuelve `id`, `title`, `status`, `createdAt` (vía `this.pick`) y `assignee: this.pick(this.resource.assignee, ['id', 'fullName', 'initials'])`. **No** hereda de `TaskTransformer` ni lo importa. Hoy su salida es idéntica a la de `TaskTransformer`; es intencionado.
- **Rationale**: FS-118 añadirá al detalle la fecha de vencimiento y la señal de vencida, y RF-15 dice que el vencimiento se ve al abrir la tarea y **no** en la lista. Si el detalle reutilizara `TaskTransformer`, añadir esos campos los filtraría a `GET /api/v1/tasks` (cambiar la forma de una respuesta existente, prohibido por BOUNDARIES.md) o obligaría a partirlo entonces, con el endpoint ya en uso. Separarlos hoy cuesta 10 líneas duplicadas y deja a FS-118 tocar un solo fichero. El test del camino feliz (§6) compara además el detalle con la fila de la lista, así que mientras deban coincidir, cualquier divergencia accidental salta.
- **Alternatives considered**:
  - Reutilizar `TaskTransformer` — el problema de arriba.
  - `class TaskDetailTransformer extends TaskTransformer` — acopla: un cambio en la lista se propaga al detalle y viceversa (vía `super.toObject()`).
  - Una variante del mismo transformer (`BaseTransformer` soporta variantes; ver `InferVariants` en `.adonisjs/client/data.d.ts`) — mantiene lista y detalle en el mismo fichero, justo lo que se quiere evitar, y el input pide un fichero propio.

## 3. Forma del `404`: se reutiliza lo de E2-4

- **Decision**: ningún cambio en `app/exceptions/handler.ts`. `Task.findOrFail` lanza `E_ROW_NOT_FOUND`, y la rama que E2-4 añadió en `handle()` ya responde `404` con `{ errors: [{ message: 'Row not found' }] }` en todos los entornos.
- **Rationale**: es la forma determinista y asertable que exige el Principio II, idéntica a la del `PATCH :id/status`. Sin esa rama el cuerpo en dev/test sería el volcado de Youch ([specs/002-cambiar-estado/research.md §3](../002-cambiar-estado/research.md#3-forma-determinista-del-404)).
- **Alternatives considered**: `Task.find()` + `response.notFound()` en la acción — contradice el input (`Task.findOrFail`) y duplica lo que el handler ya resuelve.

## 4. Id no numérico y por qué no hay `422`

- **Decision**: la ruta **no** lleva matcher. `GET /api/v1/tasks/abc` llega a `show`, `Task.findOrFail('abc')` no encuentra fila en SQLite y responde el mismo `404` de §3. El endpoint no tiene cuerpo ni query string que validar, así que **no hay rama `422`** en su matriz.
- **Rationale**: con `router.matchers.number()`, un id no numérico caería en `E_ROUTE_NOT_FOUND`, cuyo cuerpo en debug es Youch, y habría que tocar el handler de forma global. Para quien abre una tarea no hay diferencia útil entre «id raro» y «tarea que no existe» (Assumptions: «ya no existe» cubre la que nunca existió), así que un único camino de «no existe» es lo correcto. Validar `params.id` con VineJS convertiría `abc` en un `422` que el usuario nunca podría provocar desde la interfaz y que la página tendría que traducir a «ya no existe» igualmente. La constitución pide la rama `422` «cuando aplique»; aquí no aplica y se deja escrito en el contrato.
- **Alternatives considered**: matcher numérico + mapear `E_ROUTE_NOT_FOUND` (cambio global no pedido); validador de params (un `422` sin caso de usuario).

## 5. Leer no cambia nada

- **Decision**: `show` no escribe: ni `save()`, ni `merge()`, ni «último visto». La matriz relee la tarea de la BD tras el `GET` y compara `status`, `title`, `assigneeId` y `updatedAt` con los de antes.
- **Rationale**: FR-005 y SC-004 (abrir y volver no cambia ningún dato). Comparar `updatedAt` detecta además una escritura accidental aunque no cambie ningún valor visible (`autoUpdate` lo movería).
- **Alternatives considered**: confiar en que un `GET` no escribe — es justo el tipo de suposición que se pudre sin ruido.

## 6. Tests: matriz, orden y aserción de forma completa

- **Decision**: fichero nuevo `backend/tests/functional/tasks/show_task.spec.ts`, un `test.group('Tasks show (GET /api/v1/tasks/:id)')` con `group.each.setup(() => testUtils.db().truncate())`, escrito y ejecutado en **rojo** antes de ruta, acción y transformer. Casos: la matriz de [contracts/task-detail-api.md](./contracts/task-detail-api.md#matriz-de-comportamiento-definition-of-done). Cada respuesta se compara con `assert.deepEqual(response.body(), …)` contra el **cuerpo entero**. `createdAt` se toma de la propia API (`GET /api/v1/tasks`, como hace `update_task_status.spec.ts`) para no acoplar el test al formato de Luxon; y el camino feliz asserta además que `data` del detalle es `deepEqual` a la fila de esa tarea en la lista (SC-002). Helpers (`createOscar`, `createAna`, `createTask`, `fetchCreatedAt`) se declaran en el propio fichero, como en `update_task_status.spec.ts`; los tests existentes no se editan.
- **Rationale**: es la Definition of Done del Principio II v1.1.0: camino feliz + `401` + `404` (el `422` no aplica, §4), forma completa, test antes que código. Comparar con la lista convierte en test el criterio «los datos que ve coinciden con los que la lista mostraba» (escenario 2 de la US1). Los `401` asertan el cuerpo exacto, lo que prueba a la vez que no viaja ningún dato de la tarea (FR-008, SC-007).
- **Alternatives considered**: `assertBodyContains` (subconjunto; no vale para lo nuevo según la constitución); extraer los helpers a `tests/` compartido (tocaría ficheros de test existentes, fuera de alcance).

## 7. Ruta y carga en el frontend

- **Decision**: en `frontend/src/routes/app-routes.tsx`, `<Route path="/tasks/:id" element={<TaskPage />} />` **dentro** del `<Route element={<ProtectedRoute />}>` existente, junto a `/tasks`. `TaskPage` (`pages/task-page.tsx`) lee `id` con `useParams()` y el `token` con `useAuth()` (solo lectura del hook existente, `auth/` no se toca), y carga con `getTask(id, token)` en un `useEffect` dependiente de `[id, token]`. Estados: `loading` → `FullScreenLoader`; `loaded` → la vista; `not-found` (`ApiError.status === 404`) → aviso de tarea inexistente; `error` (cualquier otro) → aviso de carga fallida. El efecto marca la petición como obsoleta en su *cleanup* y resetea a `loading` al cambiar de `id`, de modo que una respuesta tardía de otra tarea nunca se pinta.
- **Rationale**:
  - Dirección propia → recargar mantiene la vista y se puede llegar sin pasar por la lista (FR-012). Sin sesión, `ProtectedRoute` manda a `/login` antes de montar la página, así que no se hace la petición ni se ve nada (FR-008, CA-9), exactamente igual que en `/tasks`.
  - Solo se pinta la vista con una tarea recibida entera del servidor: mientras carga hay un indicador, y en error hay un aviso, **nunca** una vista vacía o con datos parciales (FR-010). La guarda de obsolescencia y el reset por `id` cumplen «NO DEBE mostrar datos de ninguna otra tarea» (FR-002) también si se cambia la URL a mano, y absorben el doble efecto de `StrictMode`.
  - `/tasks/:id` casa antes que el comodín `*` (react-router ordena por especificidad), así que no cae en el `Navigate` a `/tasks`.
- **Alternatives considered**: `loader` de react-router — exige pasar a un *data router* (`createBrowserRouter`), cambio de arquitectura no pedido; pasar la tarea por `location.state` desde la lista — se pierde al recargar y mostraría datos antiguos en vez de los guardados.

## 8. El título de la fila como enlace

- **Decision**: en `task-list.tsx`, el `<span>` del título pasa a ser `<Link to={`/tasks/${task.id}`} id={`task-${task.id}-link`}>` con las mismas clases (`min-w-0 truncate font-medium`) más `hover:underline underline-offset-4` y el anillo de foco del repo (`outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-sm`). Solo el título es enlace; la tarjeta no. El responsable y el `<TaskStatusSelect>` se quedan donde están.
- **Rationale**:
  - **1 interacción** (SC-001): clic, o `Tab` hasta el enlace + `Enter`. Un `<a href>` real: se puede abrir en otra pestaña, y el lector de pantalla lo anuncia como enlace con el título como nombre accesible (el texto completo está en el DOM aunque se recorte visualmente).
  - **Gestos separados** (FR-013, escenario 8 de la US1): el `<select>` no está dentro del enlace, así que cambiar el estado no navega y abrir no cambia el estado. Hacer clicable toda la tarjeta anidaría un control interactivo dentro de un enlace (HTML inválido) o exigiría `onClick` + `stopPropagation` en el select.
  - Orden de tabulación por fila: enlace → select, después del formulario de creación; no se añade ningún punto de tabulación más.
  - `id` estable por fila → permite devolver el foco (§9).
- **Alternatives considered**: tarjeta entera clicable (arriba); un botón «Abrir» por fila — añade un punto de tabulación y ancho por fila, y un botón que navega no es un enlace.

## 9. Volver a la lista con el foco en la tarea abierta

- **Decision**: el enlace «Volver a la lista» de la página es `<Link to="/tasks" state={{ focusTaskId: task.id }}>`. En `tasks-page.tsx`, `useLocation().state?.focusTaskId` se lee y, cuando la lista termina de cargar (`isLoading` pasa a `false`), un efecto hace `document.getElementById(`task-${focusTaskId}-link`)?.focus()` (mismo patrón que el `getElementById('title')?.focus()` que ya usa la página). Si la tarea ya no está en la lista, no se enfoca nada. Desde los avisos de «ya no existe» y «no se ha podido cargar», el enlace de vuelta va a `/tasks` sin `state`.
- **Rationale**: FR-004/escenario 4 de la US1 piden que, al volver con teclado, se pueda seguir recorriendo la lista desde la tarea abierta. Al navegar, `TasksPage` se vuelve a montar y recarga la lista, así que el foco se perdería en `<body>` y el usuario de teclado empezaría desde arriba. `Link` admite `state` en react-router 8.3 (`LinkProps.state` en `dist/development/lib/dom/lib.d.ts`) y `focus()` desplaza la tarea a la vista. Se enfoca el enlace y no la tarjeta porque es el elemento desde el que se abrió.
- **Alternatives considered**: `navigate(-1)` — si se llegó a la tarea por URL directa o recargando, «atrás» saca de la app; `<ScrollRestoration>` — solo existe en *data routers* y restaura el scroll, no el foco. El botón «atrás» del navegador vuelve a `/tasks` sin `state`: la lista funciona, pero el foco no se garantiza; la vía que cumple FR-004 es el enlace de la página.

## 10. `getTask()`, mensajes y etiquetas compartidas

- **Decision**:
  - En `frontend/src/lib/api.ts`: `export function getTask(id: string, token: string): Promise<Task>` → `GET /api/v1/tasks/${encodeURIComponent(id)}`, desenvuelve `data`. `id` es `string` porque sale de `useParams()`; no se valida en el cliente (un id raro es un `404` del backend, §4). Si el error es `404`, lo relanza como `ApiError` con status `404` y el mensaje de tarea inexistente. El resto de errores (`401`, conexión, `5xx`) pasan tal cual con los mensajes que ya genera `toApiError`/`request`.
  - El comentario de `updateTaskStatus()` «Solo este endpoint responde 404…» se corrige: deja de ser cierto.
  - El tipo de respuesta es el `Task` existente de `lib/types.ts` (misma forma hoy). Cuando FS-118 añada campos al detalle, se creará `TaskDetail`.
  - `STATUS_LABELS` se mueve de `task-status-select.tsx` a `frontend/src/lib/task-status.ts` (nuevo) y lo importan el select y la página.
  - Textos (tono y forma de los existentes). En los cuatro casos la página muestra arriba el mismo enlace «Volver a la lista» (§11):

    | Caso | Origen | Lo que dice la página |
    |---|---|---|
    | Tarea inexistente | `404` | Título «Esta tarea ya no existe»; texto «Puede que alguien la haya borrado.» |
    | Sesión caducada | `401` | Título «No se ha podido cargar la tarea»; texto «Tu sesión ha caducado. Vuelve a iniciar sesión.» (ya existente) |
    | Sin conexión | `fetch` falla | Título «No se ha podido cargar la tarea»; texto «No se pudo conectar con el servidor. Comprueba que el backend está arrancado.» (ya existente); botón «Reintentar» |
    | Error de servidor | `5xx` u otro | Título «No se ha podido cargar la tarea»; texto «Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» (ya existente); botón «Reintentar» |

- **Rationale**: `CLAUDE.md` fija `lib/api.ts` como único punto de contacto y de traducción de errores. El `404` se traduce en `getTask` (no como rama genérica de `toApiError`) porque el texto de cada endpoint es distinto: en la fila, «recarga para ver la lista al día»; en la vista, «ya no existe» + volver. La página decide qué aviso pintar por `status === 404`, no por el texto, así que «ya no existe» y «no se ha podido cargar» nunca se confunden (FR-011, Edge Case). «Reintentar» solo donde puede funcionar (conexión y servidor); con la sesión caducada repetir no sirve. Compartir `STATUS_LABELS` garantiza que la vista dice lo mismo que la fila (SC-002).
- **Alternatives considered**: construir los mensajes en la página (rompe la regla de `lib/api.ts`); rama `404` genérica en `toApiError` (un único texto para dos contextos distintos); duplicar `STATUS_LABELS` en la página (pueden divergir); exportarlo desde `task-status-select.tsx` (oxlint `react/only-export-components`).

## 11. La vista

- **Decision**: `task-page.tsx` usa el mismo marco que `tasks-page.tsx` (`bg-muted/40 min-h-svh p-6` → `mx-auto flex max-w-2xl flex-col gap-6`). Arriba, el enlace «Volver a la lista» (`Button variant="link" asChild` envolviendo el `Link`, con `ArrowLeftIcon` de `lucide-react`), **primero en el orden del DOM**. Debajo, un `Card` con el título en un `<h1>` (`text-2xl font-semibold`, con `wrap-break-word` para que un título largo se lea entero, sin `truncate`) y un `<dl>` como el de `profile-page.tsx` con tres pares: «Responsable» (`assignee.fullName ?? 'Sin nombre'`, igual que la fila), «Estado» (`STATUS_LABELS[status]`) y «Creada el» (fecha, §12). El enlace de vuelta está en ese mismo sitio también cuando en lugar del `Card` se pinta un aviso: `Alert` (`variant="destructive"` para la carga fallida, `default` para «ya no existe»), con `AlertTitle`/`AlertDescription` y, en la carga fallida, el botón «Reintentar». Ningún control para cambiar el estado, editar, reasignar ni borrar.
- **Rationale**: R-8 (estilo existente, solo componentes de `ui/`); FR-006 (solo consulta); Edge Case «título muy largo». El enlace de vuelta, primero en el DOM, es lo primero que alcanza `Tab` al llegar a la página, así que volver es 1 interacción también con teclado (SC-001, SC-005). `Alert` ya lleva `role="alert"`: el aviso se anuncia solo al aparecer.
- **Alternatives considered**: `Dialog`/modal sobre la lista — no existe en `ui/` (sería un componente generado nuevo y otra forma de presentar, contra R-8), y complica la dirección propia que debe sobrevivir a recargar (FR-012); mostrar el estado con el `<select>` de la fila — la vista es solo de consulta en este cambio (FR-006).

## 12. Formato de «cuándo se creó»

- **Decision**: `new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(task.createdAt))` → p. ej. «29 de septiembre de 2026, 10:15». Zona horaria del navegador.
- **Rationale**: la spec pide fecha absoluta en castellano con día, mes, año y hora (Assumptions). Es el mismo `Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })` que ya usa `profile-page.tsx` para «Miembro desde», más la hora. `Intl` es nativo: ninguna dependencia.
- **Alternatives considered**: tiempo relativo (descartado por la spec); formato numérico `29/09/2026` (menos legible y ambiguo fuera de España); `date-fns`/Luxon en el frontend (dependencia nueva).

## 13. Código generado en `backend/.adonisjs/`

- **Decision**: no se edita a mano. Tras añadir la ruta y el transformer, `npm test` (o `npm run dev`) desde `backend/` regenera `.adonisjs/client/registry/` (ruta `tasks.show` con sus tipos) y `.adonisjs/client/data.d.ts` (tipo `Data.TaskDetail` a partir de `TaskDetailTransformer`). `.adonisjs/server/controllers.ts` no debería cambiar (`Tasks` ya está). El diff se commitea en el mismo PR.
- **Rationale**: `tests/bootstrap.ts` tipa el `apiClient` de Japa con el registro, y `CLAUDE.md` exige commitear el código generado para que un clon limpio compile.

## 14. Autenticación y CORS

- **Decision**: ningún cambio. El `401` lo produce `middleware.auth()` del grupo (guard `api`) con `{ errors: [{ message: 'Unauthorized access' }] }`. CORS ya admite `GET`. En el frontend, `ProtectedRoute` y `useAuth()` se usan tal cual.
- **Rationale**: FR-008 pide reutilizar la autenticación sin modificarla; BOUNDARIES.md la valla. Volver a la tarea tras iniciar sesión queda fuera (Assumptions): exigiría tocar `frontend/src/auth/` o `protected-route.tsx`.
