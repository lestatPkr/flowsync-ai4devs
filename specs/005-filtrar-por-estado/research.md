# Research: Filtrar la lista por estado

Phase 0 de `/speckit-plan`. Cada decisión se ha contrastado contra el código real del repo (lo que dejaron E2-1, E2-4, E2-5 y FS-118) y contra el código instalado en `backend/node_modules/` (AdonisJS 7.3, Lucid 22.4, VineJS 4.4), no contra documentación de versiones anteriores. El comportamiento de VineJS citado en §2 se ha **probado** contra `@vinejs/vine` 4.4.0 instalado, no deducido.

## 1. El parámetro: `?status=`, con los códigos internos y sensible a mayúsculas

- **Decision**: `GET /api/v1/tasks` acepta un parámetro de consulta **opcional** `status`, cuyo valor debe ser **exactamente** uno de `pending`, `in_progress` o `done` (los de `TASK_STATUSES` en `app/models/task.ts`). Se distingue mayúsculas de minúsculas: `PENDING`, `Pending` o `Pendiente` son filtros no válidos. Un solo valor; no hay sintaxis de lista ni valor «todas».
- **Rationale**:
  - La spec delega al plan cómo se nombran los estados al pedirlos desde fuera y si se distinguen mayúsculas (Assumptions). Un solo vocabulario en toda la API: son los mismos códigos que ya devuelve cada fila de la lista (`status`) y que acepta `PATCH /tasks/:id/status`. Quien consume la API ya los conoce; aceptar además las etiquetas en castellano o variantes de caja sería adivinar, que la spec prohíbe (FR-005, «nunca se adivina»).
  - `status` como nombre: es el nombre del campo en la fila y en el cuerpo de `PATCH …/status`, y el que el `422` señala (`field: 'status'`), así que el rechazo apunta a lo que se escribió.
- **Alternatives considered**:
  - Aceptar las etiquetas en castellano (`?status=Pendiente`) — dos vocabularios para lo mismo y un segundo mapeo que mantener.
  - Insensible a mayúsculas — interpretaría `PENDING` en vez de rechazarlo; el rechazo ya dice cuáles son los válidos (FR-005), así que corregirlo cuesta un intento.
  - `?status=pending,in_progress` o `?status[]=…` — CA-16 y FR-007 prohíben mezclar estados; con un único valor, la vista por defecto (pendientes + en curso) es la **ausencia** de filtro, no un filtro compuesto (Key Entities).

## 2. Validación: `vine.enum(TASK_STATUSES).optional()` sobre `request.qs()`

- **Decision**: validador nuevo en `app/validators/task.ts`:

  ```ts
  export const listTasksValidator = vine.create({
    status: vine.enum(TASK_STATUSES).optional(),
  })
  ```

  consumido en `TasksController.index` con `request.validateUsing(listTasksValidator, { data: request.qs() })`, igual que `show` valida `today` ([specs/004 research §4](../004-fecha-vencimiento/research.md)).
- **Rationale** — comportamiento **probado** con VineJS 4.4.0:

  | Query | `request.qs()` | Resultado |
  |---|---|---|
  | (ninguna) | `{}` | válido, `status` ausente → vista por defecto |
  | `?status=pending` | `{ status: 'pending' }` | válido |
  | `?status=` | `{ status: '' }` | **422** `enum` |
  | `?status=Pendiente` / `PENDING` / `archivada` / `all` | string | **422** `enum` |
  | `?status=pending&status=done` | `{ status: ['pending','done'] }` | **422** `enum` |
  | `status: null` | — | tratado como ausente; el parser de query **no** produce `null` (`?status` sin `=` da `''`) |

  Así, FR-005 (desconocido, vacío, varios, «todas» → rechazo) sale **del propio `enum`**, sin reglas extra. El `convertEmptyStringsToNull` de `config/bodyparser.ts` solo afecta a cuerpos (`form`, `json`, `multipart`), **no** a la query, por eso `?status=` llega como `''` y se rechaza en vez de convertirse en «sin filtro». El rechazo tiene la forma que ya usa toda la API (FR-006):

  ```json
  { "errors": [{ "message": "The selected status is invalid", "rule": "enum", "field": "status",
                 "meta": { "choices": ["pending", "in_progress", "done"] } }] }
  ```

  Es la misma entrada que ya aserta `update_task_status.spec.ts` (`INVALID_STATUS_ERROR`): `meta.choices` indica los tres válidos (FR-005, CA-10). El texto en castellano lo produce `frontend/src/lib/api.ts`, que ya traduce `rule: 'enum'` a «Ese estado no es válido. Elige Pendiente, En curso o Hecho.», igual que para cualquier otro `422` del producto; la API no localiza mensajes en ningún endpoint y este no es la excepción.
- **Validar `request.qs()` y no `request.all()`**: `validateUsing` por defecto valida `request.all()`, que mezcla cuerpo y query. En un `GET` no hay cuerpo, pero fijar la fuente hace explícito que el filtro sale de la URL (FR-003) y sigue el patrón de `show`.
- **Orden 401 → 422**: `middleware.auth()` corre antes del controlador, así que sin sesión la respuesta es `401` aunque el filtro sea inválido (US1-12: «no recibe ninguna tarea» y se le trata como a cualquier otra petición protegida).
- **Alternatives considered**:
  - `vine.string().in([...])` — lo mismo con más código; `vine.enum` ya es lo que usa `updateTaskStatusValidator`.
  - Reutilizar `updateTaskStatusValidator` con `.optional()` — son dos contratos distintos (cuerpo obligatorio vs. query opcional); acoplarlos haría que un cambio en uno moviera el otro.
  - Leer `request.input('status')` a mano y validar con un `if` — se saldría del formato de error de VineJS que FR-006 exige.

## 3. La vista por defecto: `whereIn` sobre los estados vivos, en el mismo query

- **Decision**: en `app/models/task.ts`, junto a `TASK_STATUSES`:

  ```ts
  /** The statuses of the default view of the list: everything that is not done (RF-21). */
  export const LIVE_TASK_STATUSES = ['pending', 'in_progress'] as const satisfies readonly TaskStatus[]
  ```

  y en `TasksController.index`, sobre el query existente (mismo `preload('assignee')` y mismo `orderBy('createdAt', 'desc').orderBy('id', 'desc')`):

  ```ts
  status ? query.where('status', status) : query.whereIn('status', LIVE_TASK_STATUSES)
  ```

  `TaskTransformer` no cambia; cada fila tiene la misma forma que hoy.
- **Rationale**: FR-001/FR-002 son un filtro de SQL sobre una columna que ya existe; filtrar en memoria traería de la BD las hechas, que es «el único conjunto que crece sin límite» (Edge Cases). Nombrar la vista por defecto en el dominio evita que la lista de estados vivos se repita (backend) y deja un solo sitio que cambiar si algún día hay un cuarto estado. El orden es el de siempre (Assumptions: «el orden de la lista no cambia»).
- **Alternatives considered**:
  - `whereNot('status', 'done')` — equivalente hoy, pero si se añade un estado entraría en la vista por defecto sin que nadie lo decida.
  - Un valor explícito para la vista por defecto (`?status=live`) — la vista por defecto no es un filtro más (Key Entities) y abriría la puerta a un «todas».

## 4. Cualquier otro parámetro se ignora (FR-011)

- **Decision**: la query solo tiene `status`. VineJS descarta las claves que el schema no declara, así que `?assigneeId=…`, `?dueDate=…` o `?today=…` en la lista **no filtran nada**: la respuesta es la misma que sin ellos. Un test lo fija.
- **Rationale**: FR-011 exige que no se ofrezca ni se acepte filtro por otra dimensión. Ignorar es no aceptarlo: la respuesta visiblemente no está acotada por responsable (trae tareas de todos). Es el comportamiento de toda la API con claves desconocidas (el `PATCH …/status` ya ignora `title` y `assigneeId`, con test), y rechazar claves desconocidas solo aquí sería un criterio nuevo que el resto de rutas no sigue.
- **Alternatives considered**: `422` ante cualquier clave no declarada — incoherente con el resto de la API y rompería clientes que añaden parámetros inocuos (cache-busting).

## 5. Saber si el espacio está vacío (FR-008, US1-11) sin cambiar la forma de la respuesta

- **Decision**: la respuesta **no** gana ningún campo ni cabecera. La distinción se obtiene del contrato mismo, porque la vista por defecto y «Hecho» son una **partición** de las tareas del espacio: el espacio no tiene ninguna tarea si y solo si `GET /tasks` y `GET /tasks?status=done` están ambos vacíos. El frontend hace esa comprobación **solo cuando la lista pedida llega vacía** y no sabe ya por su cuenta que hay tareas (§9), con una función nueva de `lib/api.ts`:

  | Vista vacía | Petición complementaria | El espacio tiene tareas si… |
  |---|---|---|
  | por defecto | `?status=done` | no está vacía |
  | `done` | sin filtro | no está vacía |
  | `pending` / `in_progress` | sin filtro, y si está vacía, `?status=done` | alguna no está vacía |

  Un test funcional fija la propiedad en la API (US1-11): en un espacio vacío ambas están vacías; en uno con todo hecho, la por defecto está vacía y la de «Hecho» no.
- **Rationale**:
  - BOUNDARIES.md prohíbe cambiar la forma de la respuesta de una ruta existente, y el input de este plan lo reitera (`200` con `[]`). El `{ data: [...] }` queda idéntico.
  - Solo cuesta peticiones de más en el caso vacío, que es el raro; a la escala de RNF-5 son lecturas indexables de una tabla pequeña (SC-011 < 1 s).
  - Sin lista viva (E3-2 fuera de alcance), la carrera entre las dos lecturas (alguien crea o completa algo entre ambas) es la misma que ya existe entre cargar la lista y mirarla; se corrige al volver a cargar.
- **Alternatives considered**:
  - Cabecera `X-Space-Task-Count` — una sola petición, pero es contrato nuevo, necesita `exposeHeaders` en `config/cors.ts` (hoy `[]`) y que `request()` de `lib/api.ts` devuelva cabeceras además del cuerpo.
  - `{ data: [], meta: { spaceIsEmpty } }` — cambia la forma de la respuesta de una ruta pública (valla).
  - Ruta nueva `GET /tasks/count` — superficie nueva para algo que el contrato ya permite saber.
  - La regla que proponía el input («`EmptyTasksState` solo cuando no hay filtro y la lista sin filtro está vacía») — incumple FR-017: en un espacio con todo hecho mostraría «Todavía no hay tareas… crea la primera» (caso c, US2-10), y con un filtro en un espacio vacío mostraría «No hay tareas en este estado» (caso b, US2-9).

## 6. Tests existentes que leen `createdAt` de la lista sin filtro

- **Decision**: antes de tocar el controlador, se cambia **solo el helper** `fetchListed`/`fetchCreatedAt` de tres ficheros existentes para que busque la fila en las dos vistas (`GET /tasks` y `GET /tasks?status=done`) en lugar de solo en la lista sin filtro. Ninguna aserción, título, dataset ni `expectedBody` cambia.

  | Fichero | Casos que hoy leen una tarea **hecha** de la lista sin filtro |
  |---|---|
  | `show_task.spec.ts` | «abre una tarea en «Hecho» como cualquier otra» |
  | `update_task_status.spec.ts` | dataset «cambia el estado de {from} a {to}» con `from: 'done'` (×2); «elegir el mismo estado que ya tiene no es un error» |
  | `task_overdue.spec.ts` | «una tarea hecha con la fecha pasada no está vencida…»; «sacar de «Hecho» una tarea con la fecha pasada vuelve a vencer» |

  `update_task_due_date.spec.ts` y `list_tasks.spec.ts` no se tocan: el primero solo lee tareas pendientes de la lista; el segundo solo crea pendientes y en curso, y sus cuatro tests siguen siendo ciertos con el comportamiento nuevo.
- **Rationale**: esos helpers usan la lista como **fixture** para obtener `createdAt` sin depender de cómo serializa Luxon; no son aserciones sobre la lista. Con FR-001 las hechas dejan de estar en ella y `find(...)!` devolvería `undefined`: los tests fallarían con un `TypeError`, no por una regresión de lo que verifican. El helper nuevo es **neutro**: antes de implementar, `?status=done` se ignora y devuelve todas (verde); después, las dos vistas cubren todas las tareas (verde). No se debilita nada ni se edita un test «para que pase» — se hace antes, en tarea propia, y la suite sigue en verde en ambos lados ([Complexity Tracking](./plan.md#complexity-tracking)).
- **Alternatives considered**:
  - Leer `createdAt` del detalle `GET /tasks/:id` — en `show_task.spec.ts` sería circular (el test verifica ese mismo endpoint).
  - Leer `createdAt` del modelo y serializarlo en el test — justo la dependencia de Luxon que esos helpers evitan a propósito.
  - No tocar nada y dejar los seis casos en rojo — la suite bloquea commit y PR (`guard-tests.mjs`).

## 7. Dónde vive el filtro: un layout de ruta sobre `/tasks` y `/tasks/:id`

- **Decision**: el filtro es un `useState<TaskStatus | null>(null)` de un componente de layout nuevo, `frontend/src/routes/tasks-layout.tsx`, que envuelve **solo** las rutas `/tasks` y `/tasks/:id` en `app-routes.tsx` (dentro de `ProtectedRoute`) y lo expone con `<Outlet context>` y un hook `useTaskFilter()`. `TasksPage` lo lee y lo cambia; `TaskPage` no lo usa. Nunca se lee ni se escribe en la URL, en `history.state`, en `localStorage` ni en `sessionStorage`.
- **Rationale**: el input pedía el estado «en memoria del componente» de `tasks-page.tsx`. Pero `TaskPage` es **otra ruta** (`/tasks/:id`): al abrir una tarea `TasksPage` se desmonta y su estado se pierde, y al volver con «Volver a la lista» se aparecería en la vista por defecto, incumpliendo FR-013 y US2-13 (con el filtro «Hecho» no se podría seguir recorriendo desde la tarea abierta). Subir el estado un nivel, a un componente que sigue montado mientras se va y vuelve de una tarea, conserva la intención del input (memoria de componente, nada persistido) y cumple a la vez:
  - **Recargar** (FR-012, US2-11): la memoria de JS se pierde → vista por defecto.
  - **Cerrar sesión y volver a entrar**: `ProtectedRoute` redirige a `/login`, el layout se desmonta → vista por defecto.
  - **Llegar por un enlace** `/tasks?status=done` (US2-12): nadie lee la query → vista por defecto, sin aviso.
  - **Ir a `/profile` y volver**: el layout se desmonta → vista por defecto (es otra visita a la lista).
  - **Otra persona** (FR-022, CA-13): el estado es de la pestaña de cada cual.
- **Alternatives considered**:
  - Estado en `TasksPage` (lo del input) — pierde el filtro al abrir/cerrar una tarea (arriba).
  - Pasar el filtro por `location.state` en los enlaces de ida y vuelta (como ya hace `focusTaskId`) — el navegador conserva `history.state` al **recargar**, así que el filtro sobreviviría a una recarga (CA-17).
  - `sessionStorage` — sobrevive a la recarga (CA-17).
  - Una variable de módulo — sobrevive a cerrar sesión y volver a entrar sin recargar (FR-012).
  - Query de la URL — el input y FR-012 lo descartan.

## 8. El control: un grupo de botones con `aria-pressed`, no un `<select>`

- **Decision**: componente nuevo `frontend/src/components/tasks/task-status-filter.tsx`: un `role="group"` con `aria-label="Filtrar por estado"` y tres `Button` de `ui/button` («Pendiente», «En curso», «Hecho», etiquetas de `STATUS_LABELS`), el aplicado con `variant="default"` y `aria-pressed="true"`, los demás `variant="outline"` y `aria-pressed="false"`; y un cuarto `Button` `variant="ghost"` «Quitar filtro», presente solo cuando hay filtro. Debajo, una línea de texto con `aria-live="polite"` que dice qué se está viendo (textos en §10). Pulsar el estado ya aplicado no hace nada.
- **Rationale**:
  - **SC-008 (≤ 2 interacciones)**: aplicar, cambiar o quitar es **un** clic o un Tab + Enter. Un `<select>` nativo cuesta dos (abrir y elegir) y no tiene un «quitar» natural sin inventar una cuarta opción que se parecería a un «Todas».
  - **FR-015 y FR-021 (sin depender del color)**: el aplicado se identifica por `aria-pressed` (lectores de pantalla), por el cambio de variante y, sobre todo, por la línea de texto que lo nombra.
  - **FR-014 y US2-2**: las únicas opciones visibles son los tres estados y quitar; no hay «Todas».
  - Sin dependencias ni componentes shadcn nuevos: `Button` ya está generado; no se usa `ToggleGroup` (habría que traerlo y añade `@radix-ui/react-toggle-group`, R-3).
- **Alternatives considered**: `<select>` nativo con las clases de `TaskStatusSelect` — permitido por el input, pero dos interacciones y un «quitar» artificial; pestañas (`role="tablist"`) — semántica de paneles, no de filtro, y el patrón de teclado con flechas no existe en el repo.

## 9. Mantener la vista cierta tras los cambios locales (FR-016, FR-020, SC-009)

- **Decision**: `TasksPage` conserva la lista cargada y la corrige al recibir cada respuesta, sin volver a pedirla:
  - **Cambio de estado confirmado** (`onTaskUpdated`): si el estado nuevo encaja en la vista (por defecto: `pending`/`in_progress`; con filtro: igual al filtro), la fila se sustituye, o se **inserta en su sitio** (orden `createdAt` desc, `id` desc) si ya no estaba; si no encaja, la fila **sale**. En ambos casos la página sabe que el espacio tiene tareas.
  - **Tarea creada** (`onCreated`): sin filtro o con «Pendiente», se antepone; con «En curso» o «Hecho», el filtro pasa a `null` y se carga la vista por defecto, que ya la incluye (FR-020).
  - **Foco**: si la fila que sale tenía el foco (el `<select>` de su estado), el foco pasa a la fila siguiente (su enlace), o a la anterior si era la última, o al encabezado del vacío si ya no quedan filas; así quien usa teclado no cae al `<body>` (FR-021).
- **Rationale**:
  - La fila sale «en cuanto el cambio se guarda» (SC-009, edge case «varios cambios seguidos»): `TaskStatusSelect` ya llama a `onUpdated` con cada confirmación del servidor y nunca con el valor optimista, así que si el guardado falla la fila se queda con su estado real (edge case «el cambio no se guarda»).
  - La inserción ordenada cubre el caso de la cola de `TaskStatusSelect`: si alguien elige «Hecho» y enseguida «Pendiente», la primera confirmación saca la fila y la segunda (que el bucle del componente sigue enviando aunque la fila se haya desmontado) la devuelve a su sitio; la vista acaba en el estado guardado.
  - Tras un cambio local que vacía la vista, **ya se sabe** que el espacio tiene tareas (la que acaba de salir), así que el vacío es (a) o (c) sin petición complementaria (§5).
  - `TaskStatusSelect` y `TaskList` no cambian de contrato.
- **Alternatives considered**: volver a pedir la lista tras cada cambio — una petición por clic y un parpadeo; esperar a que la cola de la fila se vacíe para sacarla — obligaría a cambiar `TaskStatusSelect` y retrasaría SC-009.

## 10. Estados de la lista y textos

- **Decision**: la zona de la lista (debajo del formulario y del filtro) es una máquina de estados con **clave** = filtro (patrón de `TaskPage`: si la clave del estado no es la del filtro actual, no se pinta nada de lo anterior):

  | Estado | Cuándo | Qué se ve |
  |---|---|---|
  | cargando | petición en vuelo para este filtro | nada debajo del filtro (ningún mensaje de vacío prematuro) |
  | lista | ≥ 1 tarea | `TaskList` sin cambios |
  | (a) estado sin tareas | filtro aplicado, 0 filas, el espacio tiene tareas | `Card`: **«No hay tareas en este estado»** / «Ahora mismo ninguna tarea del equipo está en «{estado}». Elige otro estado o quita el filtro para volver a la vista por defecto.» |
  | (b) espacio sin tareas | 0 filas y el espacio no tiene ninguna, con o sin filtro | `EmptyTasksState` existente, sin cambios |
  | (c) nada vivo | sin filtro, 0 filas, el espacio tiene tareas | `Card`: **«No hay nada pendiente ni en curso»** / «Todas las tareas del equipo están hechas. Para consultarlas, filtra por [Hecho].» (el enlace-botón aplica el filtro, como el «Crear tarea» de `EmptyTasksState`) |
  | filtro no válido | `422` con `fieldErrors.status` | `Alert variant="destructive"`: **«Ese filtro no es válido»** / el mensaje de la API («Ese estado no es válido. Elige Pendiente, En curso o Hecho.») / `Button` «Volver a la vista por defecto» |
  | fallo de carga | cualquier otro error | `Alert variant="destructive"`: **«No se ha podido cargar la lista»** / el mensaje de `ApiError` / `Button` «Reintentar» (salvo `401`, como en `TaskPage`) |

  Línea de estado del filtro (FR-015), siempre visible bajo los botones: sin filtro, «Mostrando pendientes y en curso. Las tareas hechas no se muestran: filtra por «Hecho» para consultarlas.»; con filtro, «Filtrando por «{estado}»: solo se muestran las tareas en ese estado.».
- **Rationale**: FR-017, FR-018, FR-019 y SC-010: cinco mensajes distintos, ninguno en lugar de otro. Los textos, en castellano y con el tono de `EmptyTasksState` y de las alertas de `TaskPage`, eran del plan (Assumptions). El filtro no válido es inalcanzable desde los botones (solo envían los tres códigos), pero la rama existe por robustez (FR-018); la distinción es por **código** (`422` + `fieldErrors.status`), no por texto (FR-006). El estado «cargando» sin mensaje evita que durante un cambio de filtro se vea, aunque sea un instante, el vacío del filtro anterior.
- **Alternatives considered**: un único componente de vacío parametrizado por texto — mezclaría (b), que tiene acción de crear, con los demás; esconder el filtro en un espacio vacío — cambiaría la pantalla existente de E2-1 más de lo necesario.

## 11. La página actual no distingue un fallo de carga de un espacio vacío

- **Decision**: `TasksPage` pasa a capturar el error de `listTasks` (estado «fallo de carga» de §10) y a descartar respuestas obsoletas: el `useEffect` que carga, con dependencias `[token, filter, attempt]`, marca `ignore = true` en su limpieza, de modo que si se cambia de filtro dos veces seguidas solo se pinta la respuesta del último.
- **Rationale**: hoy `listTasks(token).then(setTasks).finally(...)` no tiene `catch`: si la petición falla, `tasks` queda `[]` y se pinta `EmptyTasksState`, es decir, un fallo de conexión se presenta como «espacio sin tareas». FR-019 y US2-16 lo prohíben, y con filtros hay más peticiones y más ocasiones. Sin `ignore`, dos respuestas en desorden podrían dejar a la vista la lista de un filtro con el botón de otro aplicado (CA-16).
- **Alternatives considered**: `AbortController` — también válido, pero `request()` de `lib/api.ts` no acepta `signal` y habría que cambiar su firma; el `ignore` del efecto basta.

## 12. Reparto en commits y PR

- **Decision**: un PR (FS-142), en el orden que fijará `tasks.md`: helpers de los tests existentes (verde→verde) → tests nuevos de la API en rojo → validador + controlador (verde) → `lib/api.ts` → layout del filtro → control y estados de la lista. La User Story 1 queda completa y verificable (tests en verde) antes de empezar la 2.
- **Rationale**: la spec deja el reparto al plan. El cambio total es pequeño (1 validador, 1 constante, 1 acción, 1 fichero de tests nuevo + 3 helpers, 1 función de API ampliada + 1 nueva, 1 layout, 1 componente, 1 página) y la User Story 2 es la que hace observables CA-4, CA-5, CA-7, CA-8 y CA-17: separarlas dejaría un PR intermedio en el que las tareas hechas desaparecen de la interfaz sin camino de vuelta (RF-21 a medias).
- **Alternatives considered**: dos PR (API y luego interfaz) — el primero, ya desplegado, escondería lo hecho en la interfaz sin forma de consultarlo.
