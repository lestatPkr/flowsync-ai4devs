# Contract: borrar una tarea desde la interfaz

Cubre, en el frontend, FR-002 a FR-012, FR-014 a FR-016, FR-020 y FR-021, y la mitigación R5 (más la parte de interfaz de R6, R7 y R8) del [modelo de amenazas](../../../docs/security/threat-model-e2-10.md). Decisiones y alternativas en [research.md](../research.md) §8–§13 y §15–§16.

## Dónde vive

| Pantalla | ¿Acción de borrar? |
|---|---|
| Tarea abierta (`/tasks/:id`, `frontend/src/pages/task-page.tsx`) | **Sí**: botón «Borrar tarea», en el pie de la `Card` de la tarea, separado de los datos y de la fecha. Solo con la tarea cargada (no en «ya no existe» ni en el error de carga). |
| Lista (`/tasks`), fila de tarea | **No** (CA-7, FR-011, FR-012). |
| Tablero (`/tasks/board`), tarjeta | **No** (CA-7, FR-011, FR-012). |

## Piezas

| Pieza | Fichero | Qué hace |
|---|---|---|
| `deleteTask(id, token)` | `frontend/src/lib/api.ts` | `DELETE /api/v1/tasks/:id` con `Authorization: Bearer`. `204` → `Promise<void>`. `404` → `ApiError(404)` con «Puede que alguien la haya borrado.» (vía `taskNotFound`, como `getTask` y `setDueDate`). `401` y el resto, los `ApiError` de siempre. `RequestOptions.method` admite `'DELETE'`. Única llamada nueva a la API. |
| `DeleteTaskDialog` | `frontend/src/components/tasks/delete-task-dialog.tsx` (nuevo) | `<dialog>` nativo con `showModal()`, compuesto con `Button` de `ui/`. Props: `task` (`id`, `title`), `token`, `open`, `onCancel()`, `onDeleted()`, `onNotFound(error)`. |
| `TaskDeletedNotice` | `frontend/src/components/tasks/task-deleted-notice.tsx` (nuevo) | El aviso «Se ha borrado «título».» de un solo uso en la lista y el tablero. |
| `TaskPage` | `frontend/src/pages/task-page.tsx` | Botón «Borrar tarea», abre el diálogo, navega al terminar, pasa a `not-found` con un `404`. |
| `TasksPage`, `BoardPage` | `frontend/src/pages/tasks-page.tsx`, `board-page.tsx` | Pintan `TaskDeletedNotice` arriba de la vista. |
| Cabeceras anti-*framing* | `frontend/vite.config.ts` | `server.headers` y `preview.headers`: `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`. |

Ninguna dependencia nueva. `frontend/src/components/ui/` y `frontend/src/auth/` no se tocan.

## Estructura accesible del diálogo

```text
<dialog aria-labelledby="delete-task-title" aria-describedby="delete-task-description">  ← :modal
  <div>                                   ← todo el contenido (el <dialog> no tiene padding)
    <h2 id="delete-task-title">¿Borrar «{título}»?</h2>
    <p id="delete-task-description">Se borrará para todo el equipo y no se podrá recuperar: …</p>
    [<p role="alert">{error}</p>]          ← solo si falló
    <Button variant="outline">Cancelar</Button>                ← foco inicial
    <Button variant="destructive">Borrar definitivamente</Button>
  </div>
</dialog>
```

- Mismo `size` en los dos botones: igual de visibles (US1-6). «Cancelar» va primero en el orden de tabulación.
- El título va entero, con `wrap-break-word`; el contenido hace scroll si no cabe.

## Estados del diálogo

| Estado | Entra por | Cancelar / clic fuera | Escape | «Borrar definitivamente» |
|---|---|---|---|---|
| `closed` | — | — | — | — |
| `open`, desarmado (500 ms) | «Borrar tarea» | ignorado | → `closed` | ignorado |
| `open`, armado | fin de la guarda | → `closed` | → `closed` | → `deleting` |
| `deleting` | confirmar | ignorado | ignorado | ignorado (botón: «Borrando…») |
| `error` | `401`, red u otro | → `closed` | → `closed` | → `deleting` (reintento) |

Salidas de `deleting`:

| Respuesta | Resultado |
|---|---|
| `204` | `navigate(destino, { replace: true, state: { deletedTaskTitle } })`. Destino: `/tasks/board` si `location.state.from === 'board'`, si no `/tasks`. Allí, `TaskDeletedNotice` con el foco. |
| `404` | Diálogo cerrado; `TaskPage` en `not-found` («Esta tarea ya no existe» + «Puede que alguien la haya borrado.», `Alert` por defecto). Foco en «Volver a la lista»/«Volver al tablero». |
| `401` | `error` con «Tu sesión ha caducado. Vuelve a iniciar sesión.» |
| Red / otro | `error` con «No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.» |

Si el navegador cierra el `<dialog>` por su cuenta (evento `close` con el diálogo aún abierto para React: Chromium no deja cancelar un segundo Escape sin activación de usuario), en `deleting` se vuelve a abrir con `showModal()` y en cualquier otro estado cuenta como cancelar.

Al pasar a `closed` sin borrar, el foco vuelve al botón «Borrar tarea». En `open`/`error`, Tab y Mayús+Tab dan la vuelta entre los dos botones sin salir del diálogo.

## Textos

| Dónde | Texto exacto |
|---|---|
| Botón de la tarea abierta | `Borrar tarea` |
| Título del diálogo | `¿Borrar «{título}»?` |
| Descripción | `Se borrará para todo el equipo y no se podrá recuperar: no hay papelera ni forma de deshacerlo.` |
| Opción que no borra | `Cancelar` |
| Opción que borra | `Borrar definitivamente` · durante la petición: `Borrando…` |
| Aviso tras borrar | `Se ha borrado «{título}».` |
| Ya no existe | título `Esta tarea ya no existe` · descripción `Puede que alguien la haya borrado.` |
| Fallo | `No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.` |
| Sin sesión | `Tu sesión ha caducado. Vuelve a iniciar sesión.` |

Ningún texto nombra a quien creó, lleva o borró la tarea, ni distingue una tarea propia de una ajena.

## Diseño

Solo tokens semánticos (Principio VI): diálogo `bg-card text-card-foreground border rounded-xl`, contenido `p-6`, `m-auto` (el *preflight* de Tailwind lo descentra), `max-w-md w-[calc(100%-2rem)]`, *backdrop* `backdrop:bg-background/80`; aviso en `text-muted-foreground` sobre el fondo de la página; anillo de foco el de siempre (`focus-visible:ring-[3px] ring-ring/50`). `Button variant="destructive"` en «Borrar tarea» y en «Borrar definitivamente»; `variant="outline"` en «Cancelar». Ningún token nuevo; DESIGN.md gana el patrón «Confirmación destructiva».

## Interacciones (FR-011)

Desde la lista o el tablero: cambiar el estado = 2; borrar = 3 (abrir la tarea → «Borrar tarea» → «Borrar definitivamente»).

## Matriz de comportamiento (Definition of Done)

Principio II v1.2.0. Todos en `frontend/e2e/delete-task.spec.ts`, **escritos y vistos en rojo antes** de tocar el frontend; contra el backend real (que ya tiene el `DELETE` de [delete-task-api.md](./delete-task-api.md) cuando se escriben). Un test por escenario de interfaz de la spec, titulado como el escenario (`US1-1 · DADO …, CUANDO …, ENTONCES …`), más un test de axe con el diálogo abierto.

Convenciones: se arma antes de toda activación deliberada de «Cancelar», «Borrar definitivamente» o del clic fuera; solo US2-2 y US2-3 trabajan sin armar. «sin `DELETE`» = 0 peticiones `DELETE` vistas con `page.on('request')`; «sigue» / «ya no está» = código de `GET /api/v1/tasks/:id` por la API (`200` / `404`), como otro miembro; «armar» = `page.clock.fastForward(500)` tras abrir; «sin dejar armar» = `page.clock.pauseAt(...)` antes del gesto ([research §15](../research.md#15-tests-e2e-playwright)).

| Test | Escenario | Qué comprueba |
|---|---|---|
| `US1-1` | Pide borrar y confirma | Desde la lista: abrir la tarea, «Borrar tarea», armar, «Borrar definitivamente» → la tarea ya no está en la lista ni en el tablero; la marca en `window` sigue (sin recargar); la tarea sale de la pantalla en menos de 1 s tras confirmar (SC-002); «ya no está» por la API. |
| `US1-2` | Otra persona carga lista o tablero | Ana, en su propio contexto con `signIn`, no la ve en `/tasks` ni en `/tasks/board`. |
| `US1-3` | Tarea que creó y lleva otra persona | Oscar borra una tarea de Ana; el texto del diálogo es el mismo patrón que con una propia y no menciona a Ana ni dice «ajena»; se borra. |
| `US1-4` | La pregunta bloquea el resto | Tras «Borrar tarea», `getByRole('dialog')` visible y `dialog.matches(':modal')` es `true`; sin `DELETE`. |
| `US1-5` | Título y «no se podrá recuperar» | Nombre accesible del diálogo = `¿Borrar «{título}»?` con un título de 200 caracteres entero; descripción accesible contiene «no se podrá recuperar». |
| `US1-6` | Opciones claras y destructiva distinguida | Botones `Borrar definitivamente` (`data-variant="destructive"`) y `Cancelar`, ambos visibles y de la misma altura; no hay «Aceptar». |
| `US1-7` | Tras borrar, aviso sin deshacer | En la lista: `role="status"` con «Se ha borrado «{título}».» y el foco en él; ningún botón ni enlace «Deshacer»; tras recargar, el aviso ya no está. |
| `US1-8` | Fallo de conexión | `page.route` aborta el `DELETE` → el diálogo sigue con «No se ha podido borrar la tarea…»; tras cancelar, la tarea sigue a la vista y «sigue» por la API; nunca se vio el aviso de borrado. Y con un `500` simulado (`route.fulfill`), el mismo texto, sin el mensaje crudo del cuerpo (FR-007). |
| `US2-1` | Cancelar no borra y devuelve el foco | Tres veces (botón, Escape, clic fuera con el ratón en una esquina del *backdrop*): el diálogo se cierra, el foco vuelve a «Borrar tarea», título/responsable/estado/fecha iguales que antes, sin `DELETE`. |
| `US2-2` | Enter recién abierto no borra | Con el reloj en pausa: abrir con el teclado, foco en «Cancelar», pulsar Enter → sin `DELETE`, tarea a la vista. |
| `US2-3` | Doble clic o doble tecla | Con el reloj en pausa: `dblclick` en «Borrar tarea» → diálogo abierto, sin `DELETE`; cerrar con Escape; Enter, Enter sobre «Borrar tarea» → diálogo abierto, sin `DELETE`. |
| `US2-4` | Borrar cuesta más que cambiar de estado | En la lista y en el tablero no hay ningún botón cuyo nombre empiece por «Borrar»; cambiar el estado se hace con el `<select>` (2 interacciones) y borrar exige abrir la tarea (3). |
| `US2-5` | Sin sesión o con la sesión cerrada | (a) sin sesión, `/tasks/:id` lleva a `/login` y no hay «Borrar tarea»; (b) con el diálogo abierto, `logOut` por la API y confirmar → «Tu sesión ha caducado…» en el diálogo; la tarea «sigue». |
| `US2-6` | Otra persona ya la borró | Ana la borra por la API (`deleteTask`); Oscar confirma → «Esta tarea ya no existe» + «Puede que alguien la haya borrado.» en un `Alert` no destructivo; nada de «Algo ha ido mal»; la tarea ya no se muestra. |
| `US2-7` | «Hecho» no es borrar | En la lista, pasar la tarea a «Hecho» no abre ningún diálogo; sale de la vista por defecto; con el filtro «Hecho» sigue y se abre. |
| `US2-8` | Todo con el teclado | Solo teclado desde la lista: Tab hasta la tarea, Enter, Tab hasta «Borrar tarea», Enter → foco en «Cancelar»; Tab → «Borrar definitivamente»; Tab → «Cancelar» (vuelta); Mayús+Tab → «Borrar definitivamente»; Escape → foco en «Borrar tarea»; reabrir, armar, Tab, Enter → en la lista con el foco en el aviso. `toBeFocused` en cada paso y `:focus-visible` en los botones; que el anillo se vea se comprueba a mano ([quickstart](../quickstart.md) §4.7). |
| `US3-4` | No se puede incrustar | `page.setContent('<iframe src="http://localhost:5173/tasks">')` → el marco no pinta la aplicación (ningún encabezado dentro). |
| `US3-5` | Ningún mensaje atribuye el borrado | Tras el aviso de borrado de Oscar y tras el «ya no existe» que ve Ana cuando lo borró Oscar, ningún texto de la página contiene el nombre de quien borró. |
| `A11Y` | Diálogo abierto (SC-008) | `expectNoSeriousA11yViolations` con el diálogo abierto, con el diálogo en `error`, y en la lista con el aviso. |

Los escenarios solo de servidor (US3-1, US3-2, US3-3, US3-6) se prueban en la [matriz del API](./delete-task-api.md#matriz-de-comportamiento-definition-of-done). Los e2e existentes (`smoke`, `board`, `task-status-list`) siguen en verde **sin editarse**.
