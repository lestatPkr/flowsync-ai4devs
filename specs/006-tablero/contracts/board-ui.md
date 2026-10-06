# Contract: el tablero (interfaz)

Cubre las tres historias de [spec.md](../spec.md) en el frontend. **Solo frontend**: ni rutas, ni modelos, ni transformers, ni tests del backend cambian. Sin dependencias nuevas, sin componentes shadcn nuevos, sin editar `frontend/src/components/ui/` y sin tocar `frontend/src/auth/` (valla). Las razones de cada decisión, en [research.md](../research.md).

## API consumida (sin cambios en el backend)

| Uso | Petición | Respuesta que se usa |
|---|---|---|
| Cargar cada columna | `GET /api/v1/tasks?status=pending` · `…=in_progress` · `…=done` (en paralelo) | `{ data: Task[] }`, orden `createdAt` desc, `id` desc |
| Mover una tarjeta | `PATCH /api/v1/tasks/:id/status` con `{ status }` | `{ data: Task }`; errores como `ApiError` (`0` red, `401`, `404`, `422`, `5xx`) |

Las dos, solo a través de `lib/api.ts`.

## `lib/api.ts`

```ts
/**
 * Las tareas del tablero: una lectura por estado, en paralelo. Falla entera si
 * falla cualquiera (nunca columnas a medias) y no repite una tarea que llegue
 * en dos lecturas (se queda la primera, en el orden de las columnas).
 */
export function listTasksByStatus(token: string): Promise<Record<TaskStatus, Task[]>>
```

`listTasks`, `updateTaskStatus`, `toApiError` y los mensajes existentes **no cambian**.

## `lib/task-status-sync.ts` (nuevo)

```ts
export type TaskStatusSyncHandlers = {
  /** Cada confirmación del servidor; `settled` = no queda ninguna elección en cola. */
  onSaved: (task: Task, settled: boolean) => void
  /** El cambio no se guardó: `confirmed` es el último estado guardado. */
  onFailed: (taskId: number, confirmed: TaskStatus, error: ApiError) => void
}

export function createTaskStatusSync(
  token: string,
  handlers: TaskStatusSyncHandlers,
): { change: (task: Task, next: TaskStatus) => void }
```

- Una petición en vuelo por tarea; lo elegido mientras tanto se encola (solo lo último) y sale al terminar si difiere del confirmado; un fallo descarta la cola. Es el comportamiento actual de `TaskStatusSelect`, movido aquí sin cambios.
- Un error que no sea `ApiError` se convierte en `ApiError('Algo ha ido mal. Inténtalo de nuevo.', 0)` (el texto que hoy usa `TaskStatusSelect`).
- Sin `fetch` propio: llama a `updateTaskStatus`.

## `lib/task-status.ts`

Gana `export function byListOrder(a: Task, b: Task): number` (`createdAt` desc y, a igualdad, `id` desc), movida desde `pages/tasks-page.tsx`, que pasa a importarla. `STATUS_LABELS` y su orden no cambian: es el orden de las columnas.

## `components/tasks/task-status-control.tsx` (nuevo) y `task-status-select.tsx`

```ts
type TaskStatusControlProps = {
  task: Pick<Task, 'id' | 'title'>
  value: TaskStatus
  error?: string
  onChange: (status: TaskStatus) => void
}
```

- Es el marcado actual de `TaskStatusSelect`, sin cambios: `<select>` nativo con las mismas clases, `aria-label="Estado de «{título}»"`, una `<option>` por entrada de `STATUS_LABELS`, `aria-invalid` y `aria-describedby="task-{id}-status-error"` cuando hay error, `FieldError` debajo, **nunca** `disabled`.
- `TaskStatusSelect` mantiene sus props (`task`, `token`, `onUpdated`) y su comportamiento en la lista: estado mostrado local, `createTaskStatusSync` propio, `onUpdated` en cada confirmación, vuelta al confirmado y mensaje de `ApiError` **sin prefijo** si falla.

## Ruta

`frontend/src/routes/app-routes.tsx`, dentro de `ProtectedRoute` y de `TasksLayout`:

```tsx
<Route element={<TasksLayout />}>
  <Route path="/tasks" element={<TasksPage />} />
  <Route path="/tasks/board" element={<BoardPage />} />   {/* nueva */}
  <Route path="/tasks/:id" element={<TaskPage />} />
</Route>
```

- Sin sesión: `ProtectedRoute` lleva a `/login`, como hoy (US1-11).
- La redirección de `*` a `/tasks` y la de `PublicOnlyRoute` a `/tasks` no cambian: se entra por la lista (FR-007).

## Página `/tasks/board` (`pages/board-page.tsx`)

Contenedor `bg-muted/40 min-h-svh p-6`, ancho completo. De arriba abajo:

1. **Cabecera**: `h1` «Tablero» y, a su derecha, el enlace **«Lista»** → `/tasks` (`Button variant="outline" size="sm" asChild` + `Link`, `ListIcon` `aria-hidden`).
2. **Anuncio de estado**: `<p role="status" className="sr-only">` (siempre presente; ver [anuncios](#anuncios-y-mensajes)).
3. **Zona del tablero**, una de estas situaciones, mutuamente excluyentes y distintas a simple vista (FR-022, US3-7):

| Situación | Condición | Contenido |
|---|---|---|
| Cargando | sin respuesta del intento actual | `<p role="status">` con `Loader2Icon` animado `aria-hidden` y el texto «Cargando el tablero…». **Ninguna** región de columna. |
| Error de carga | `listTasksByStatus` rechaza | `Alert variant="destructive"`: `AlertTitle` «No se ha podido cargar el tablero» · `AlertDescription` con `ApiError.message` + `Button variant="outline" size="sm"` «Reintentar» (nuevo intento), salvo si es `401`. **Ninguna** región de columna (FR-008, US1-10). |
| Espacio sin tareas | cargado, 0 tareas | `Card` + `CardHeader`: `CardTitle` «Todavía no hay tareas» · `CardDescription` «Las tareas se crean desde la lista. [Ir a la lista] para anotar la primera.» («Ir a la lista» es un `Link` a `/tasks`), **y debajo** las tres columnas, cada una con su vacía (FR-021, US3-4). |
| Cargado | cargado, ≥ 1 tarea | Las tres columnas. |

### Columnas (`components/board/board-column.tsx`)

Rejilla `grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start`. Tres columnas, siempre, en este orden: `pending`, `in_progress`, `done`.

| Elemento | Marcado | Nombre accesible |
|---|---|---|
| Columna | `Card` con `role="region"`, `aria-labelledby="board-column-{estado}-title"`, `min-w-0`, `gap-3 px-4 py-4` | «Pendiente (2 tareas)», «En curso (1 tarea)», «Hecho (0 tareas)» |
| Encabezado | `<h2 id="board-column-{estado}-title" className="flex items-center gap-2 text-lg font-semibold">` con `{STATUS_LABELS[estado]}`, la píldora `<span aria-hidden="true" className="rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground">{n}</span>` y `<span className="sr-only">({n} tarea\|tareas)</span>` | el mismo que la región |
| Tarjetas | `<ul className="flex flex-col gap-2">`, un `<li>` por tarea | lista de *n* elementos |
| Vacía | en lugar del `<ul>`: `<p className="text-muted-foreground text-sm">No hay tareas en este estado.</p>` | — |

- **Destino de soltar**: la región entera (también vacía). `dragover`/`drop` solo actúan si se arrastra una tarjeta de **otra** columna; entonces la columna muestra `bg-accent border-ring` mientras la tarjeta está encima.
- El recuento se calcula de las tarjetas pintadas: siempre coincide con ellas (FR-003).

### Tarjeta (`components/board/board-card.tsx`)

```tsx
<li id="board-task-{id}" draggable onDragStart onDragEnd className="… data-[dragging=true]:opacity-50">
  <Card className="gap-2 px-4 py-3">
    <Link id="board-task-{id}-link" to="/tasks/{id}" state={{ from: 'board' }} draggable={false}
          className="font-medium wrap-break-word …foco como en la lista…">{title}</Link>
    <span className="text-muted-foreground text-sm">{assignee.fullName ?? 'Sin nombre'}</span>
    <TaskStatusControl task={task} value={task.status} error={errors[id]} onChange={…} />
  </Card>
</li>
```

- Muestra **solo** título, responsable y estado (FR-004): ni prioridad, ni foto/iniciales, ni fecha, ni «Vencida».
- Orden de tabulación dentro de la tarjeta: título → control de estado. El `<li>` no es enfocable.
- Ningún botón de crear, borrar, editar, reasignar ni filtrar (FR-010).

### Mover

| Gesto | Efecto inmediato | Si se guarda | Si falla |
|---|---|---|---|
| Elegir otro estado en el control | La tarjeta pasa a su nueva columna (en su sitio por `byListOrder`), recuentos al día, anuncio «… está en …», foco al control de esa tarjeta en la nueva columna | Se sustituye por la tarea que devuelve el servidor | Vuelve a la columna del último estado confirmado, recuentos vuelven, mensaje en la tarjeta, anuncio de fallo, foco a su control (si estaba en ella o se había caído al `<body>`) |
| Soltar en otra columna | Igual que elegir ese estado | Igual | Igual |
| Soltar en su columna o fuera de cualquier columna | Nada: ni petición, ni mensaje, ni foco (FR-017) | — | — |
| Otro cambio de la misma tarjeta con uno en vuelo | La tarjeta pasa ya a la última elección; se encola | Acaba en la última elección | Vuelve al último confirmado y se descarta la cola |

## Anuncios y mensajes

Textos exactos (`{t}` = título de la tarea, `{E}` = `STATUS_LABELS` del estado):

| Cuándo | Dónde | Texto |
|---|---|---|
| Se mueve (select o arrastre) | anuncio `role="status"` | `«{t}» está ahora en «{E nuevo}».` |
| El cambio no se guarda | anuncio `role="status"` | `No se ha guardado el cambio: «{t}» vuelve a «{E confirmado}».` |
| El cambio no se guarda | `FieldError` de la tarjeta (visible, `aria-describedby` del control) | `No se ha guardado el cambio. ` + `ApiError.message` |
| … con `500` u otro `5xx` | ídem | «No se ha guardado el cambio. Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» |
| … sin conexión | ídem | «No se ha guardado el cambio. No se pudo conectar con el servidor. Comprueba que el backend está arrancado.» |
| … con `401` | ídem | «No se ha guardado el cambio. Tu sesión ha caducado. Vuelve a iniciar sesión.» |
| … con `404` | ídem | «No se ha guardado el cambio. Esta tarea ya no existe: puede que alguien la haya borrado. Recarga la página para ver la lista al día.» |
| Columna vacía | dentro de la región | «No hay tareas en este estado.» |
| Espacio sin tareas | `Card` sobre las columnas | «Todavía no hay tareas» · «Las tareas se crean desde la lista. Ir a la lista para anotar la primera.» |
| Cargando | zona del tablero | «Cargando el tablero…» |
| Error de carga | `Alert` destructivo | «No se ha podido cargar el tablero» · `ApiError.message` · «Reintentar» |

El mensaje de la tarjeta se borra al hacer el siguiente cambio de esa tarea.

## Foco

| Situación | Adónde va |
|---|---|
| Cambio con el control (y su vuelta atrás si falla) | Al control de estado de esa tarjeta, en la columna donde queda |
| Cambio arrastrando (y su vuelta atrás) | Igual |
| Vuelta atrás tardía con el foco ya en otro elemento | No se mueve |
| Volver de una tarea abierta desde el tablero | Al título de esa tarjeta (`board-task-{id}-link`) |
| Llegar al tablero desde la lista | Donde lo deja el navegador al navegar (sin gestión especial) |

## Enlaces entre vistas

- **Lista** (`pages/tasks-page.tsx`): la cabecera pasa a ser `h1` «Tareas» + enlace **«Tablero»** → `/tasks/board` (`Button variant="outline" size="sm" asChild` + `Link`, `Columns3Icon` `aria-hidden`). Nada más cambia en la lista.
- **Tarea** (`pages/task-page.tsx`): si `location.state?.from === 'board'`, el enlace de vuelta dice **«Volver al tablero»** y va a `/tasks/board` con `state={{ focusTaskId }}`; si no, sigue diciendo «Volver a la lista» y yendo a `/tasks`, como hoy. Aplica también a las variantes «no existe» y «error» de la página.

## Helpers de `frontend/e2e/support.ts`

Se añaden (los existentes no cambian):

```ts
/** Deja una tarea en un estado por la API, como ese miembro. */
export function setTaskStatus(request: APIRequestContext, member: Member, taskId: number, status: 'pending' | 'in_progress' | 'done'): Promise<void>

/** Pone la fecha de vencimiento ('AAAA-MM-DD') de una tarea por la API. */
export function setTaskDueDate(request: APIRequestContext, member: Member, taskId: number, day: string): Promise<void>

/**
 * Acota el tablero a las tareas cuyo título empieza por `prefix`: intercepta
 * GET /api/v1/tasks?status=*, hace la petición real (route.fetch) y responde
 * solo con esas filas. Para los escenarios que necesitan columnas vacías en una
 * BD compartida. Los PATCH no se tocan.
 */
export function scopeBoardTo(page: Page, prefix: string): Promise<void>
```

## Matriz de comportamiento (Definition of Done)

`frontend/e2e/board.spec.ts`, escrito **antes** de la implementación y visto en **rojo**. Un test por escenario de aceptación, titulado con su id y el escenario. Cada test crea sus miembros y tareas con títulos únicos; contra el backend real.

### US1 (P1) — ver el tablero y abrir una tarea

| Test | Cómo |
|---|---|
| `US1-1 · DADO tareas en los tres estados, CUANDO abre el tablero, ENTONCES ve tres columnas en orden y cada tarea una sola vez en la de su estado, sea suya o de otra persona` | Dos miembros; tareas propias y ajenas llevadas a cada estado con `setTaskStatus`. Exactamente 3 regiones de columna, en orden; cada título aparece 1 vez, dentro de la región de su estado. |
| `US1-2 · DADO tareas hechas, CUANDO abre el tablero, ENTONCES están en «Hecho» sin elegir ningún filtro` | Una tarea `done`; está en la región «Hecho» al cargar; no hay control de filtro en la página. |
| `US1-3 · DADO un tablero cargado, CUANDO mira cada cabecera, ENTONCES ve el nombre del estado y un recuento igual a sus tarjetas` | Para cada región: número del nombre del `h2` = número de `listitem`. |
| `US1-4 · DADO un tablero cargado, CUANDO mira una tarjeta, ENTONCES ve título, responsable y estado, y nada de prioridad, foto, vencimiento ni marca de vencida` | Tarea vencida (`setTaskDueDate` con un día pasado). La tarjeta tiene enlace con el título, el nombre del responsable y el control con su estado; no contiene «Vence», «Vencida», la fecha, `img` ni las iniciales. |
| `US1-5 · DADO un miembro en el tablero, CUANDO activa el título de una tarjeta, ENTONCES llega a la vista de esa tarea` | Clic en el título → URL `/tasks/{id}`, `h1` con el título. |
| `US1-6 · DADO una tarea abierta desde el tablero, CUANDO vuelve, ENTONCES regresa al tablero con el foco en esa tarjeta` | «Volver al tablero» → URL `/tasks/board`; el título de esa tarjeta `toBeFocused`. |
| `US1-7 · DADO la lista, CUANDO quiere ver el tablero, ENTONCES llega con una interacción; Y desde el tablero vuelve a la lista con otra` | Clic en «Tablero» → `/tasks/board`; clic en «Lista» → `/tasks`. |
| `US1-8 · DADO un miembro que usó el tablero, CUANDO entra a FlowSync sin indicar vista, ENTONCES aparece en la lista` | Visita `/tasks/board` y **afirma primero** el `h1` «Tablero» (si no, nacería en verde). Luego, en la misma página, `goto('/')` → `/tasks` con `h1` «Tareas». Y, para el «inicia sesión» del escenario, en un **contexto nuevo** (`browser.newContext()`, sin nada en memoria de la visita anterior): `signIn` con el mismo miembro y `goto('/')` → `/tasks` con `h1` «Tareas», no el tablero. |
| `US1-9 · DADO solo el teclado, CUANDO va de la lista al tablero, recorre las tarjetas, abre una tarea, vuelve y regresa a la lista, ENTONCES puede hacerlo todo en orden de columnas y tarjetas` | `scopeBoardTo`; solo `Tab`/`Shift+Tab`/`Enter`. Desde la lista, `Tab` hasta «Tablero», `Enter`; la secuencia de `Tab` recorre título → control de cada tarjeta, columna a columna; `Enter` en un título; «Volver al tablero» con `Enter`; foco en esa tarjeta; `Shift+Tab` hasta «Lista», `Enter` → `/tasks`. |
| `US1-10 · DADO un tablero que no consigue cargar, CUANDO lo mira, ENTONCES ve un mensaje y «Reintentar», y no tres columnas vacías` | `page.route` de `GET …/tasks?status=*` → `500`. Alerta «No se ha podido cargar el tablero» con «Reintentar»; 0 regiones; `expectNoSeriousA11yViolations` en ese estado de error. Se quita la ruta, «Reintentar» → 3 regiones. |
| `US1-11 · DADO una persona sin sesión, CUANDO intenta llegar al tablero, ENTONCES no ve ninguna tarea` | En el mismo test: sin `signIn`, `goto('/tasks/board')` → `/login`, sin ninguna región de columna. Después `signUp` + `signIn` y `goto('/tasks/board')` → `h1` «Tablero». La segunda mitad es la que lo hace nacer en **rojo por la razón correcta** (hoy `/tasks/board` lo captura `/tasks/:id`, que ya está dentro de `ProtectedRoute`, así que la primera mitad sola pasaría sin tablero) y la que detecta una ruta del tablero que quede fuera de `ProtectedRoute`. |

### US2 (P2) — mover de columna

| Test | Cómo |
|---|---|
| `US2-1 · DADO una tarjeta en «Pendiente», CUANDO la arrastra a «En curso», ENTONCES aparece allí sin recargar, los recuentos cambian en uno Y sigue allí al recargar` | Recuentos antes; `card.dragTo(regiónEnCurso)`; tarjeta en «En curso», «Pendiente» −1 y «En curso» +1; `reload()` y sigue en «En curso». |
| `US2-2 · DADO solo el teclado y el foco en una tarjeta de «En curso», CUANDO elige «Hecho» en su control, ENTONCES pasa a «Hecho», los recuentos cambian Y el foco sigue en esa tarjeta` | `Tab` hasta el control (afirmando foco); `selectOption('done')` sobre el control enfocado; tarjeta en «Hecho»; su control `toBeFocused`. |
| `US2-3 · DADO cualquier tarjeta, CUANDO usa su control de estado, ENTONCES es el de la lista: solo tres estados y ≤ 2 interacciones, sin confirmación` | Opciones exactamente «Pendiente», «En curso», «Hecho»; mismo `aria-label` que en la lista; un `selectOption` cambia sin diálogo (`page.on('dialog')` no salta). |
| `US2-4 · DADO una tarjeta propia o ajena, CUANDO la mueve a cualquiera de las otras dos columnas, ENTONCES se acepta, incluidas las vueltas desde «Hecho» y el salto de «Pendiente» a «Hecho»` | Tarea ajena `pending` → arrastre a «Hecho»; tarea `done` → control a «Pendiente». Tras recargar, cada una en su nueva columna. |
| `US2-5 · DADO una tarjeta que se mueve, CUANDO el cambio no se guarda, ENTONCES vuelve a su columna, los recuentos vuelven Y sale un mensaje que dice que no se ha guardado` | `page.route` de `PATCH …/tasks/*/status` → `500`. Arrastre a «En curso»: la tarjeta acaba en «Pendiente», recuentos como antes, texto «No se ha guardado el cambio. Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» en la tarjeta. En el **mismo test** (sin tests nuevos en la matriz), dos rechazos más sobre la misma tarjeta, cada uno con la misma comprobación (vuelve a «Pendiente», recuentos como antes) y su texto literal de [anuncios y mensajes](#anuncios-y-mensajes): el `PATCH` → `401` («No se ha guardado el cambio. Tu sesión ha caducado. Vuelve a iniciar sesión.») y el `PATCH` con `route.abort()` («No se ha guardado el cambio. No se pudo conectar con el servidor. Comprueba que el backend está arrancado.»). |
| `US2-6 · DADO una tarea borrada por otra persona, CUANDO mueve su tarjeta, ENTONCES no se muestra movida Y el mensaje dice que ya no existe, distinto del de conexión` | `PATCH` → `404` simulado (no hay ruta de borrado; [research §9](../research.md#9-tests-e2e-contra-una-base-de-datos-compartida)). La tarjeta sigue en su columna; mensaje con «Esta tarea ya no existe»; no contiene «Algo ha ido mal». |
| `US2-7 · DADO una tarjeta que se arrastra, CUANDO la suelta en su misma columna o fuera de cualquier columna, ENTONCES queda donde estaba sin mensaje` | Se cuentan los `PATCH`; `dragTo` a su propia región y luego al `h1`. 0 `PATCH`, tarjeta en su columna, sin mensaje de error. |
| `US2-8 · DADO una tarjeta que se mueve, CUANDO se ve el cambio, ENTONCES conserva título y responsable, las demás no cambian Y ocupa el sitio que le toca por orden` | Tres tareas creadas en orden (A, B, C); A y C en «En curso». Arrastrar B a «En curso» soltando abajo: el orden de las del test en «En curso» es C, B, A; título y responsable de B intactos; las otras dos, en su columna. |
| `US2-9 · DADO una tarea pasada a «Hecho» en el tablero, CUANDO vuelve a la lista, ENTONCES no está en la vista por defecto y sí al filtrar por «Hecho»` | Control a «Hecho»; «Lista»; no está el enlace; filtro «Hecho» → está. |

### US3 (P3) — columnas vacías y pantallas estrechas

| Test | Cómo |
|---|---|
| `US3-1 · DADO un espacio sin tareas en «En curso», CUANDO abre el tablero, ENTONCES esa columna muestra 0 y un mensaje de vacía` | `scopeBoardTo` con tareas del test solo en `pending` y `done`. Región «En curso (0 tareas)» con «No hay tareas en este estado.» y sin `list`. |
| `US3-2 · DADO una columna con una sola tarjeta, CUANDO la mueve, ENTONCES la columna muestra su vacía en el acto Y si el cambio no se guarda el mensaje desaparece` | `scopeBoardTo`. Mover la única de «Pendiente» → aparece la vacía. Con `PATCH` → `500` retenido: mover → vacía visible; soltar el `500` → la tarjeta vuelve y la vacía desaparece. |
| `US3-3 · DADO una columna vacía, CUANDO mueve una tarjeta a ella, ENTONCES el mensaje desaparece y se ve la tarjeta` | `scopeBoardTo`; arrastre a la región vacía «En curso». |
| `US3-4 · DADO un espacio sin ninguna tarea, CUANDO abre el tablero, ENTONCES ve las tres columnas vacías y la indicación de crear desde la lista, con forma de ir` | `scopeBoardTo` con un prefijo sin tareas. Tres vacías; «Todavía no hay tareas»; «Ir a la lista» → `/tasks`. |
| `US3-5 · DADO una pantalla estrecha, CUANDO abre el tablero, ENTONCES las columnas se apilan en orden con su recuento Y la página no se desplaza en horizontal` | Viewport 320 × 800; una tarea con título muy largo. Regiones en orden con `y` creciente y misma `x`; `scrollWidth <= clientWidth`. |
| `US3-6 · DADO una pantalla estrecha, CUANDO cambia el estado de una tarjeta con su control, ENTONCES pasa a su nueva columna y el foco sigue en ella` | Viewport 320 × 800; `Tab` + `selectOption`; tarjeta en la nueva región; control `toBeFocused`. |
| `US3-7 · DADO un tablero cargando, con error de carga o con columnas vacías, CUANDO lo mira, ENTONCES cada situación se ve distinta` | Respuesta retenida: «Cargando el tablero…», sin regiones ni alerta. `500`: alerta, sin regiones ni «Cargando». `scopeBoardTo` vacío: regiones con vacías, sin alerta ni «Cargando». |

### Casos límite y accesibilidad

| Test | Cómo |
|---|---|
| `Caso límite · mover dos veces seguidas la misma tarjeta deja la última elección, en pantalla y guardada` | Primer `PATCH` retenido; control a «En curso» y luego a «Hecho»; se suelta. Tarjeta en «Hecho»; tras recargar, en «Hecho». |
| `SC-007 · el tablero no tiene violaciones graves ni críticas de accesibilidad con tareas, con columnas vacías y con un cambio fallido` | `expectNoSeriousA11yViolations` en los tres estados (el de columnas vacías con `scopeBoardTo`; el fallido con `PATCH` → `500`). |

## Tests de caracterización de la lista

`frontend/e2e/task-status-list.spec.ts`, escritos **antes** de extraer la reconciliación de `TaskStatusSelect` ([research §2](../research.md#2-la-reconciliación-optimista-por-qué-taskstatusselect-no-basta-tal-cual)). Fijan el comportamiento actual: **verdes antes y después** del refactor, sin tocar ninguna aserción.

| Test | Fija |
|---|---|
| `Lista · cambiar el estado desde la fila se guarda y sigue así al recargar` | camino feliz del control en la lista |
| `Lista · pasar una tarea a «Hecho» la saca de la vista por defecto` | `onUpdated` en cada confirmación |
| `Lista · si el cambio no se guarda, el control vuelve al estado anterior con el mensaje de lib/api.ts` | `PATCH` → `500`; valor anterior y «Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.» **sin prefijo** |
| `Lista · dos cambios seguidos acaban en el último elegido` | cola: primer `PATCH` retenido, dos elecciones, estado final guardado = la última |
