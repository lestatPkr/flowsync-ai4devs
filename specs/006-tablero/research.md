# Research: Tablero de tareas por estado

Decisiones técnicas del plan ([plan.md](./plan.md)). Cada sección: **Decisión**, **Razón** y **Alternativas descartadas**. El cambio es solo de frontend: ninguna ruta, modelo, transformer ni test del backend cambia.

## 1. Cargar el tablero: una petición por columna

**Decisión**: tres `GET /api/v1/tasks?status=<estado>` en paralelo (`pending`, `in_progress`, `done`), envueltas en una función nueva de `lib/api.ts`, `listTasksByStatus(token)`, que devuelve `Record<TaskStatus, Task[]>` y falla entera si falla cualquiera de las tres (`Promise.all`). Cada columna pinta exactamente la respuesta de su estado, en el orden en que llega.

**Razón**:

- **No existe una sola petición que traiga todo.** `GET /api/v1/tasks` sin `status` devuelve la vista por defecto de la lista (pendientes y en curso, RF-21, `specs/005-filtrar-por-estado/`); las hechas solo llegan con `?status=done`. Una petición única exigiría cambiar el backend (una ruta nueva o un `status=all`), que este alcance prohíbe.
- **Una por columna hace que la columna sea la respuesta**: sin repartir en el cliente, el invariante FR-002 («cada tarea en la columna de su estado») lo da el servidor, que ya filtra por estado en SQL. El orden dentro de cada columna es el de la lista (`createdAt` desc, `id` desc) sin reordenar nada (FR-018).
- **Sabe sin peticiones extra si el espacio está vacío** (FR-021): las tres respuestas vacías son, exactamente, el espacio sin tareas. La lista necesita `spaceHasTasks()` para eso; el tablero no.
- **Coste**: tres peticiones pequeñas en paralelo, del mismo origen, sobre SQLite local. A la escala de RNF-5 (~200 tareas) la latencia es la de la más lenta, no la suma (SC-009).
- **Todo o nada**: si una falla, el tablero enseña el error de carga (FR-008), nunca dos columnas llenas y una vacía que parezca «sin tareas».

**Consistencia entre las tres lecturas**: no son atómicas; si otra persona mueve una tarea entre una y otra, podría llegar en dos respuestas o en ninguna. La ventana es de milisegundos y ver en vivo los cambios ajenos está fuera de alcance (E3-2). `listTasksByStatus` **descarta duplicados por `id`** (se queda con la primera aparición, en el orden de las columnas) para que una tarea nunca salga dos veces (FR-002); la siguiente carga lo corrige.

**Alternativas descartadas**:

- *Dos peticiones* (vista por defecto + `?status=done`, la partición que ya usa `spaceHasTasks`): ahorra una petición pero obliga a repartir `pending`/`in_progress` en el cliente por el campo `status`, duplicando en el frontend una regla que el servidor ya aplica. Ganancia despreciable.
- *Ruta nueva o `?status=all` en el backend*: prohibido (el backend no se toca) y, además, cambiaría la semántica del parámetro que fijó `specs/005`.
- *Llamar a `listTasks` tres veces desde la página*: funcionaría, pero la regla «todo o nada + sin duplicados» es conocimiento de la API y va en `lib/api.ts` (CLAUDE.md: toda llamada nueva a la API, ahí).

## 2. La reconciliación optimista: por qué `TaskStatusSelect` no basta tal cual

**Hallazgo**: `TaskStatusSelect` guarda **dentro del componente** el estado mostrado, el último confirmado, si hay una petición en vuelo y la elección en cola (`useState` + `useRef`), y solo avisa al padre (`onUpdated`) cuando el servidor **confirma**. En la lista funciona porque la fila nunca cambia de padre. En el tablero, mover una tarjeta la cambia de `<ul>` (de columna), y React **desmonta** el componente de la columna vieja y monta uno nuevo en la nueva: se pierden la petición en vuelo, la cola y el último confirmado. Consecuencias si se reutilizara sin más:

- La tarjeta no saltaría de columna hasta que el servidor confirmase (FR-014 pide «de inmediato»).
- Si se moviera de forma optimista desde el padre, un fallo llegaría a un componente ya desmontado: el padre nunca se enteraría y la tarjeta se quedaría en una columna que no es su estado guardado (viola FR-015 y SC-005).
- Dos cambios seguidos de la misma tarea (caso límite de la spec) saldrían en paralelo desde dos instancias distintas, sin cola: el orden de llegada decidiría el estado final.

**Decisión**: separar las dos cosas que hoy hace `TaskStatusSelect`, sin cambiar lo que hace en la lista:

1. **`lib/task-status-sync.ts`** (nuevo, sin React, sin `fetch`: usa `updateTaskStatus` de `lib/api.ts`): la reconciliación tal cual existe hoy —una petición en vuelo por tarea, la última elección en cola, y vuelta al último estado confirmado si falla—, pero **indexada por id de tarea** y con el estado fuera de cualquier componente. Avisa con `onSaved(task, settled)` en cada confirmación (`settled` = no queda nada en cola) y con `onFailed(taskId, confirmed, error)`.
2. **`components/tasks/task-status-control.tsx`** (nuevo): el control visible —el mismo `<select>` nativo, mismas clases, mismo `aria-label` («Estado de «{título}»»), mismas tres opciones, mismo `FieldError` con `aria-describedby`, nunca `disabled`—, controlado (`value`, `error`, `onChange`), sin lógica de red.
3. **`TaskStatusSelect`** conserva su API (`task`, `token`, `onUpdated`) y su comportamiento en la lista; por dentro pasa a ser `TaskStatusControl` + una instancia propia de la sincronización.
4. **El tablero** usa el mismo `TaskStatusControl` en cada tarjeta y **una** sincronización para toda la página, que sobrevive a que la tarjeta cambie de columna. El arrastre entra por la misma puerta (`change(task, next)`), así que select y arrastre comparten cola: soltar una tarjeta mientras su select tiene un cambio en vuelo se encola igual.

Así la reconciliación es **una sola** (la de `specs/002-cambiar-estado/`) y el control es **el mismo** que el de la lista (FR-012), que es lo que pedía el input; lo que cambia es dónde vive el estado.

**Refactor con red**: tocar `TaskStatusSelect` es refactorizar un comportamiento existente sin tests e2e. Por el principio II, antes del refactor se escriben **tests de caracterización** de la lista (`frontend/e2e/task-status-list.spec.ts`): verdes antes y verdes después, sin cambiar ninguna aserción (ver [contrato](./contracts/board-ui.md#tests-de-caracterización-de-la-lista)).

**Alternativas descartadas**:

- *Reutilizar `TaskStatusSelect` sin tocarlo*: los tres fallos de arriba.
- *Añadirle props opcionales (`onChange`, `onFailed`) y seguir con el estado dentro*: no resuelve el desmontaje (la cola y el último confirmado se pierden igual).
- *Evitar el desmontaje* pintando todas las tarjetas bajo un mismo padre y colocándolas con CSS en su columna: rompe la estructura accesible que pide el input (las tarjetas, una lista **dentro** de su columna) y el orden de tabulación por columnas.
- *Copiar el bucle de la lista en el tablero*: dos implementaciones de la misma reconciliación que pueden divergir; justo la clase de fallo que `specs/002` arregló con la cola.

## 3. Arrastrar y soltar con la API nativa de HTML5

**Decisión**:

- **Qué se arrastra**: el `<li>` de cada tarjeta, con `draggable`. Su enlace de título lleva `draggable={false}` (los enlaces son arrastrables por defecto y arrastrarían la URL en vez de la tarjeta); el `<select>` no inicia arrastres.
- **`dragstart`** (tarjeta): `dataTransfer.effectAllowed = 'move'`, `dataTransfer.setData('text/plain', String(task.id))` (sin `setData` algunos navegadores no inician el arrastre) y la página guarda el id arrastrado en su estado (`draggingId`). **`dragend`**: limpia `draggingId`, haya soltado o no.
- **Dónde se suelta**: la **columna entera** (la región), no la lista: así una columna vacía admite soltar igual que una llena (US3-3). `dragover` llama a `preventDefault()` (eso es lo que la convierte en destino) y pone `dropEffect = 'move'` **solo** si hay un `draggingId` y la tarjeta no es de esa columna; en su propia columna no se hace nada y el navegador muestra «no se puede soltar». `dragenter`/`dragleave` marcan la columna como destino activo (un contador, porque `dragleave` salta al pasar por cada hijo).
- **`drop`**: lee el id de `draggingId` (no depende de `getData`, que en algunos navegadores no está disponible hasta el `drop`), y si la columna es otra, llama al mismo `change(task, estado)` que el select (§2). Soltar en la misma columna o fuera de cualquier columna no llega a `change`: nada cambia y no sale ningún mensaje (FR-017).
- **Dónde cae dentro de la columna**: en su sitio según el orden de la lista (`byListOrder`), nunca en el punto donde se soltó (FR-018). No hay indicador de posición dentro de la columna.
- **Feedback visual**, solo con tokens: la tarjeta arrastrada con `opacity-50`; la columna destino con `bg-accent` y borde `border-ring`. Ningún token nuevo (§10).

**Razón**: la API nativa basta para «coger una tarjeta y soltarla en otra columna» sin reordenar; no entra ninguna dependencia (BOUNDARIES.md: nada de dnd-kit ni similares). **Playwright** (`locator.dragTo`) dispara en Chromium la secuencia real de eventos de arrastre de HTML5, así que el e2e prueba el arrastre de verdad, contra el backend real.

**Límites aceptados** (y por qué no rompen la spec):

- En pantallas táctiles los navegadores no disparan los eventos de arrastre de HTML5 con el dedo: la spec ya dice que el camino garantizado allí es el control de estado (supuestos de la spec; RNF-9).
- La imagen fantasma la pinta el navegador; no se personaliza.

**Alternativas descartadas**: dnd-kit, react-dnd, `@hello-pangea/dnd` (dependencias nuevas, prohibidas); arrastre propio con `pointer events` (mucho más código para lo mismo y sin ganar accesibilidad, que la da el select).

## 4. Accesibilidad del arrastre nativo

**Hallazgo**: el arrastre nativo de HTML5 **no es operable con teclado** ni lo exponen los lectores de pantalla. `aria-grabbed` y `aria-dropeffect` están **obsoletos** en ARIA 1.1 y los lectores no los anuncian.

**Decisión**:

- **El arrastre es un atajo de ratón, nunca el único camino.** Cada tarjeta lleva su control de estado (`TaskStatusControl`), alcanzable con Tab y operable en ≤ 2 interacciones (FR-012, DESIGN.md: «una acción por arrastre tiene siempre una alternativa por teclado y por clic»). Lo que se puede hacer arrastrando se puede hacer con el select, sin excepción.
- **Sin ARIA de arrastre**: ni `aria-grabbed`, ni `aria-dropeffect`, ni `aria-roledescription="arrastrable"` (anunciaría una capacidad que con teclado no existe). El `<li>` arrastrable no es enfocable: no añade paradas de tabulación vacías.
- **Un único anuncio de estado por página** (`<p role="status" className="sr-only">`), porque al cambiar de columna la tarjeta se desmonta y el `FieldError` de su select, por sí solo, no se anuncia: dice adónde ha ido la tarjeta y, si falla, que no se guardó y adónde vuelve ([textos exactos](./contracts/board-ui.md#anuncios-y-mensajes)).
- **El estado de la tarjeta se lee sin color**: el valor del select y el nombre de la columna (región con nombre).
- **axe** (`expectNoSeriousA11yViolations`) sobre el tablero con tareas, con columnas vacías y con un cambio fallido (SC-007).

**Alternativas descartadas**: arrastre «por teclado» (espacio para coger, flechas para mover, espacio para soltar) — es reinventar el select con más teclas y más estado, y la spec ya pide el control de la lista como camino sin ratón.

## 5. Adónde va el foco al mover

**Regla**: **el foco sigue a la tarjeta movida y se queda en su control de estado**, también cuando vuelve atrás porque el cambio no se guardó. Nunca cae al `<body>`.

- **Con el select** (FR-016, US2-2, US3-6): al elegir otro estado, la tarjeta se desmonta de su columna y se monta en la nueva; tras pintar, la página enfoca el `<select>` de esa tarjeta en su nueva posición. Si el cambio falla y vuelve, se enfoca otra vez el `<select>`, ya en la columna de origen, con el mensaje enlazado por `aria-describedby`. Se enfoca el control (y no el título) porque es lo que la persona estaba usando: puede corregir o volver a cambiar sin moverse.
- **Arrastrando**: tras soltar se aplica la misma regla (el foco va al control de la tarjeta movida). Con ratón no cuesta nada y deja al teclado en un sitio útil si se combina.
- **Cuándo no se roba**: la vuelta atrás de un fallo puede llegar tarde. Solo se mueve el foco si estaba **dentro de esa tarjeta** o se había **caído al `<body>`** por el desmontaje; si la persona ya está en otra parte (otra tarjeta, el enlace «Lista»), se queda allí y el anuncio de estado (§4) y el mensaje en la tarjeta dicen lo que ha pasado.
- **Mecánica**: la página guarda en un `ref` el id de la tarjeta a enfocar y un `useEffect` posterior al render la enfoca por id (`board-task-{id}` → su `select`), igual que la lista hace con `focusIfRemoved`.
- **Al volver de una tarea abierta desde el tablero** (FR-005, US1-6): el foco va al **título** de esa tarjeta (`board-task-{id}-link`), como hace la lista con `focusTaskId`.

**Alternativas descartadas**: dejar el foco donde estaba (se pierde: el nodo ya no existe); llevarlo al encabezado de la columna nueva (obliga a volver a buscar la tarjeta); llevarlo a la tarjeta siguiente de la columna de origen (es lo que hace la lista, donde la fila **desaparece** de la vista; en el tablero la tarjeta sigue a la vista, solo cambia de sitio).

## 6. Estructura accesible del tablero

**Decisión**:

- `h1` «Tablero». Tres columnas, en el DOM en el orden «Pendiente», «En curso», «Hecho» (el orden de `STATUS_LABELS`), cada una una **región** con nombre: `Card` (componiendo `ui/card`, sin editarlo) con `role="region"` y `aria-labelledby` apuntando a su `h2`.
- El `h2` dice el nombre del estado y el recuento. Visualmente, el nombre y una píldora con el número; para el árbol de accesibilidad, el número de la píldora va `aria-hidden` y un `sr-only` dice «(N tareas)» / «(1 tarea)». Nombre accesible resultante: «Pendiente (3 tareas)»; el de la región, el mismo.
- Dentro, las tarjetas son un `<ul>` de `<li>` (lista con su número de elementos, que anuncian los lectores). Una columna vacía **no** pinta un `<ul>` vacío: pinta el mensaje de vacía.
- Orden de tabulación = orden del DOM: columnas de izquierda a derecha (de arriba abajo cuando se apilan) y, en cada columna, tarjetas de arriba abajo; en cada tarjeta, título y luego control de estado (FR-024, US1-9). Ningún `tabIndex` positivo.
- El recuento se deriva de las tarjetas que se pintan (`tasks.filter(estado).length`), así que nunca discrepa de ellas (FR-003, SC-002), tampoco durante un cambio optimista o su vuelta atrás.

**Alternativas descartadas**: `role="grid"`/`listbox` (exigen navegación con flechas propia, más ARIA y más tests, para lo que Tab ya resuelve); `<section>` sin `Card` (habría que replicar a mano las clases del componente de `ui/`).

## 7. Navegación entre lista y tablero, y volver desde una tarea

**Decisión**:

- **Ruta** `/tasks/board`, dentro de `ProtectedRoute` y de `TasksLayout` (`frontend/src/routes/app-routes.tsx`). React Router da prioridad al segmento estático `board` sobre `:id`, así que no choca con `/tasks/:id` (los ids son numéricos).
- **Enlaces**: en la cabecera de la lista, junto al `h1`, un enlace «Tablero»; en la cabecera del tablero, uno «Lista». Ambos `Button variant="outline" size="sm" asChild` + `Link`, con icono de `lucide-react` (ya dependencia: `Columns3Icon`, `ListIcon`) `aria-hidden`. Una interacción en cada sentido (FR-006).
- **La lista sigue siendo la entrada** (FR-007): no se toca la redirección de `*` a `/tasks` ni la de `PublicOnlyRoute`, y no se guarda en ningún sitio cuál fue la última vista. Recargar en `/tasks/board` muestra el tablero (tiene dirección propia, supuesto de la spec).
- **Volver desde la tarea al tablero** (FR-005): el título de la tarjeta enlaza a `/tasks/:id` con `state={{ from: 'board' }}`. `TaskPage` lee `location.state.from`: si es `'board'`, su enlace de vuelta dice «Volver al tablero» y lleva a `/tasks/board` con `state={{ focusTaskId }}`; si no, se queda exactamente como hoy («Volver a la lista»). Si se recarga la tarea, el `state` se pierde y «volver» lleva a la lista: aceptable (se vuelve al punto de entrada). El botón atrás del navegador vuelve al tablero en cualquier caso.
- **El filtro de la lista**: el tablero no lo lee ni lo cambia. Como vive en `TasksLayout`, sobrevive a ir al tablero y volver, igual que a abrir una tarea y volver; recargar, cerrar sesión o ir a `/profile` lo devuelven a la vista por defecto, sin cambios respecto a `specs/005`.

**Alternativas descartadas**: `navigate(-1)` para volver (si se llega a la tarea por enlace directo, sacaría de la app); guardar la vista en `localStorage` (contradice FR-007); un query `?from=board` (ensucia la URL de la tarea con algo que no es de la tarea).

## 8. Pantallas estrechas y textos largos

**Decisión**: rejilla `grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start` (`gap-md` = 12 px, DESIGN.md Layout). Por debajo de `md` (768 px) las columnas se apilan en el mismo orden. Cada columna `min-w-0` (sin él, un hijo de rejilla no encoge por debajo de su contenido) y cada título `wrap-break-word` (como en `TaskPage`): un título largo parte líneas en vez de ensanchar la columna. La página usa el ancho completo con el margen `p-6` (DESIGN.md: las vistas de varias columnas pueden usar el ancho completo). Nada con ancho fijo ni `overflow-x`.

**Prueba**: viewport de 320 × 800 (SC-008): `document.documentElement.scrollWidth <= clientWidth`, y las cajas de las tres regiones apiladas (misma `x`, `y` creciente). En escritorio (1280 de ancho, el de `Desktop Chrome`), las tres a la misma `y`.

## 9. Tests e2e contra una base de datos compartida

**Contexto**: `playwright.config.ts` arranca el backend real sobre la misma SQLite del servidor de desarrollo; el espacio es **compartido** (RF-16), así que el tablero de un test enseña también las tareas de otros tests y de cualquier uso manual. Los recuentos absolutos y «la columna está vacía» no se pueden afirmar sin más.

**Decisión**:

- **Datos propios**: cada test da de alta sus miembros (`signUp`) y crea sus tareas por la API con **títulos únicos** (prefijo con `Date.now()` + aleatorio). Las aserciones de «dónde está» se hacen sobre esas tarjetas.
- **Recuentos**: se afirma el invariante (el número del encabezado = número de `listitem` de la región, FR-003) y las **diferencias** antes/después de un movimiento (−1 / +1, US2-1). `workers: 1` garantiza que nada concurrente cambia la BD durante el test.
- **Columnas vacías y espacio vacío** (US3-1 a US3-4, el orden de tabulación de US1-9 y su axe): imposibles de garantizar en una BD compartida. Se usa un helper nuevo de `e2e/support.ts`, **`scopeBoardTo(page, prefix)`**, que intercepta `GET /api/v1/tasks?status=*`, hace la petición **real** al backend (`route.fetch()`) y responde con las filas cuyo título empieza por el prefijo del test. El tablero ve datos reales del backend, solo acotados a los del test; los `PATCH` no se interceptan y van al backend de verdad.
- **Fallo al guardar** (US2-5, US3-2, axe con fallo): `page.route` sobre `PATCH **/api/v1/tasks/*/status` respondiendo `500` (lo pide el input).
- **Tarea borrada** (US2-6): **no hay ruta de borrado** en la API y el backend no se toca, así que no se puede borrar de verdad desde el test. Se simula la respuesta que el backend ya da para una tarea inexistente (`404` con el cuerpo de error de Adonis, contrato de `specs/002-cambiar-estado/`) con `page.route`. Lo que se prueba es el tratamiento del `404` en el tablero.
- **Cargando** (US3-7) y **dos cambios seguidos** (caso límite): `page.route` que **retiene** la respuesta real hasta que el test la suelta, para observar el estado intermedio de forma determinista.
- **Teclado** (US1-9, US2-2): se llega al control con `Tab` (afirmando `toBeFocused` en cada paso relevante) y se elige el estado con `selectOption` sobre el `<select>` ya enfocado: Playwright no puede manejar el desplegable nativo del sistema, y `selectOption` emite los mismos eventos `input`/`change` que elegir con el teclado. Ningún clic de ratón en esos tests.
- **Helpers nuevos en `e2e/support.ts`** (y solo ahí): `setTaskStatus(request, member, taskId, status)` (PATCH por la API, para dejar tareas en un estado), `setTaskDueDate(request, member, taskId, day)` (PUT, para US1-4: una tarea vencida no enseña nada de su fecha en la tarjeta) y `scopeBoardTo(page, prefix)`.

**Alternativas descartadas**: borrar o truncar la BD desde los tests (destruye el estado del servidor de desarrollo, que comparte fichero); una BD de test aparte (exige tocar la configuración del backend); afirmar recuentos absolutos (frágil por diseño).

## 10. Diseño: tokens y componentes

**Decisión**: **ningún token nuevo**. Todo lo que el tablero necesita ya existe en `frontend/src/index.css` y en DESIGN.md:

| Elemento | Tokens / componente |
|---|---|
| Página | `bg-muted/40`, `p-6` (como la lista) |
| Columna | `Card` (`bg-card`, `border`, `rounded-xl`), `role="region"` |
| Recuento | píldora `rounded-full bg-secondary text-secondary-foreground` (DESIGN.md: píldoras solo para estado o recuento; `secondary-foreground` sobre `secondary` cumple AA) |
| Tarjeta | `Card` compacta como la fila de la lista (`px-4 py-3`); título `font-medium`; responsable `text-muted-foreground` sobre `card` (AA) |
| Columna destino al arrastrar | `bg-accent` + `border-ring` |
| Tarjeta arrastrada | `opacity-50` |
| Error al mover | `FieldError` (`text-destructive`) dentro de `TaskStatusControl` |
| Vacíos | texto `text-muted-foreground` en la columna; `Card` + `CardHeader` para el espacio vacío |
| Error de carga | `Alert variant="destructive"` + `Button variant="outline" size="sm"` «Reintentar» |
| Enlaces de vista | `Button variant="outline" size="sm" asChild` + `Link` |

No hay color por estado: DESIGN.md lo permite pero no lo exige, y el estado ya se lee por la columna y el select. Ningún color del prototipo entra (principio VI). `components/ui/` no se edita ni se amplía (no hace falta ningún componente shadcn nuevo).

**DESIGN.md** gana, en «Components», dos patrones del tablero (columna con recuento; destino al arrastrar), sin tocar tokens ni el bloque YAML, para que la siguiente vista de columnas no los reinvente. Como no hay token nuevo, `index.css` no cambia.

## 11. Textos

Todos en castellano, cortos y en el tono de la lista. Exactos en el [contrato](./contracts/board-ui.md#anuncios-y-mensajes). Dos decisiones:

- **Cambio no guardado**: el tablero compone, y pasa como `error` al `TaskStatusControl` de la tarjeta, «No se ha guardado el cambio.» seguido del mensaje de `ApiError` que ya produce `lib/api.ts` (500 → «Algo ha ido mal en el servidor…»; red → «No se pudo conectar…»; 401 → «Tu sesión ha caducado…»; 404 → «Esta tarea ya no existe…»). El prefijo hace falta porque la spec exige que el mensaje **diga que el cambio no se ha guardado** (US2-5) y los mensajes de `lib/api.ts` no lo dicen; el `404` queda distinto del fallo de conexión (US2-6) sin texto nuevo en `lib/api.ts`. En la lista el control sigue mostrando el mensaje sin prefijo, como hoy (la caracterización lo fija).
- El mensaje de `404` de `lib/api.ts` termina en «Recarga la página para ver la lista al día.»; en el tablero se lee igual de bien (recargar es lo que hay que hacer) y no se cambia: tocarlo cambiaría el texto de la lista.

## 12. Orden dentro de cada columna

**Decisión**: el de la lista, `createdAt` desc y, a igualdad, `id` desc. La función `byListOrder` sale de `tasks-page.tsx` a `lib/task-status.ts` (exportada) y la usan las dos páginas: al recolocar una tarjeta movida en su nueva columna se inserta y se ordena con ella (FR-018, US2-8). Las respuestas ya llegan en ese orden; solo se reordena tras un movimiento.

## 13. Reparto del trabajo

Un PR, en este orden de commits (los hace el humano):

1. Tests de caracterización de la lista (`e2e/task-status-list.spec.ts`), en verde contra el código actual.
2. Extracción `lib/task-status-sync.ts` + `TaskStatusControl`; `TaskStatusSelect` encima de ellos. Caracterización sigue en verde.
3. Helpers de `e2e/support.ts` + `e2e/board.spec.ts` completo, **en rojo** (no existe la ruta).
4. US1 (P1): `listTasksByStatus`, ruta, página, columna, tarjeta, enlaces, «Volver al tablero». Sus tests en verde.
5. US2 (P2): arrastre, sincronización en el tablero, foco y anuncios. Sus tests en verde.
6. US3 (P3): vacíos y pantallas estrechas; DESIGN.md. Todo `npm run test:e2e` en verde.
