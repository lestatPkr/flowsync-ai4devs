# Research: Borrar una tarea

Fase 0 de [plan.md](./plan.md). Resuelve lo que la spec deja al plan (textos, dónde vive la acción, cómo se confirma) y lo que pide el [modelo de amenazas](../../docs/security/threat-model-e2-10.md) en el lado técnico. Cada sección: **Decisión**, **Razón**, **Alternativas descartadas**.

## 1. Endpoint, controlador y acción

**Decisión**: `DELETE /api/v1/tasks/:id`, acción `destroy` de `TasksController`, registrada **dentro** del grupo `tasks` de `backend/start/routes.ts` que ya lleva `.use(middleware.auth())`: `router.delete(':id', [controllers.Tasks, 'destroy'])`. Nombre de ruta resultante: `tasks.destroy`. Respuesta de éxito: `204` sin cuerpo con `response.noContent()`, sin pasar por `serialize()`.

**Razón**: borrar es una operación sobre el recurso `tasks` entero, como `show`; el estado y la fecha viven en `TaskStatusesController` y `TaskDueDatesController` porque son sub-recursos (`:id/status`, `:id/due-date`). `destroy` es el nombre convencional de AdonisJS para el verbo `DELETE` sobre un recurso. Colgar la ruta del grupo existente hereda `auth()` sin repetirlo (R1, S-1) y deja intactas las demás rutas (BOUNDARIES.md). El `204` sin cuerpo es lo que pide R7: nada de la tarea ni de quién la borró sale en la respuesta; `serialize()` envolvería en `{ data }` y no hay nada que envolver.

**Alternativas descartadas**:
- *Controlador propio (`TaskDeletionsController`)*: no hay sub-recurso; partirlo así rompe la convención del repo.
- *`200` con la tarea borrada en el cuerpo*: filtra datos de una tarea que ya no existe (R7, FR-021) y no lo usa nadie.
- *`router.resource('tasks', …)`*: registraría rutas que no existen y cambiaría nombres de las actuales.

## 2. El `:id` se valida en forma canónica, no se interpreta

**Decisión**: la acción solo acepta un `:id` que sea un entero positivo escrito en forma canónica (`/^[1-9]\d*$/` y `Number.isSafeInteger`). Cualquier otra cosa lanza `new lucidErrors.E_ROW_NOT_FOUND(Task)` **antes** de tocar la BD, y la rama de `E_ROW_NOT_FOUND` de `backend/app/exceptions/handler.ts` (sin cambios) la responde con el mismo `404 { errors: [{ message: 'Row not found' }] }` que un id inexistente. Con un id válido: `Task.findOrFail(id)` y `task.delete()` sobre esa instancia.

**Razón**: comprobado contra SQLite (`sqlite3 :memory:`), la afinidad numérica de la columna `id INTEGER` convierte el texto antes de comparar:

| `:id` recibido | ¿Casa con la fila `id = 1`? |
|---|---|
| `01` | **sí** |
| `1.0` | **sí** |
| ` 1` (espacio delante) | **sí** |
| `1e0` | **sí** |
| `1 OR 1=1` | no (Lucid parametriza) |
| `1,2` | no |

Es decir, `Task.findOrFail(params.id)` a secas borraría la tarea 1 con `DELETE /api/v1/tasks/01`. No es una inyección (la consulta va parametrizada), pero sí una referencia «mal formada» que borra (FR-018, R4: «el id no se interpreta»). Validar la forma en la acción cierra esa puerta sin tocar el manejador ni otras rutas. Lanzar la misma excepción de Lucid garantiza que el cuerpo del `404` es idéntico en todos los casos (FR-018: «se responde igual que esa tarea no existe»).

Buscar por clave primaria y borrar **la instancia** (`task.delete()`) en vez de un `Task.query().where(...).delete()` montado con la entrada hace imposible por construcción que una petición borre más de una fila (R3, R4).

**Alternativas descartadas**:
- *Matcher de ruta (`.where('id', router.matchers.number())`)*: un id que no casa da `E_ROUTE_NOT_FOUND`, con un cuerpo distinto del `404` del manejador (y, con `debug`, con traza: I-1); además `matchers.number()` acepta `01`.
- *Validar `:id` con VineJS*: daría `422`, y el input y FR-018 piden que un id no válido se responda como «no existe».
- *Endurecer también `show`, `status` y `due-date`*: tienen la misma laxitud, pero son lecturas o escrituras no destructivas y cambiar su comportamiento es otra historia (BOUNDARIES.md: ninguna otra ruta cambia). Se deja anotado para el backlog.

## 3. Borrado real y anónimo

**Decisión**: `task.delete()` hace un `DELETE FROM tasks WHERE id = ?` real. Sin migración, sin columna `deleted_at` ni `deleted_by`, sin tabla aparte, sin `logger` en la acción. `tasks` es una tabla hoja: ninguna FK apunta a ella, así que no hay cascadas ni huérfanos.

**Razón**: FR-022 (borrado real), FR-023 y RNF-7 (nadie guarda quién borró), R9. El kernel no registra un logger de peticiones y `LOG_LEVEL=info`, así que la acción no añade ninguna línea con el usuario. Se comprueba en el test (la fila no existe en `tasks`) y en la revisión del diff (ninguna migración, ningún `logger.*`).

**Alternativas descartadas**: *borrado lógico*: contradice FR-022 y el PRD (sin papelera). *Registrar al autor*: lo prohíbe RNF-7; es una decisión de producto pendiente, no de este plan.

## 4. Sesión: `401` y por qué solo vale la cabecera `Authorization`

**Decisión**: no se toca nada de auth. `middleware.auth()` sin guards usa el guard por defecto, `api` (`config/auth.ts`), que solo lee `Authorization: Bearer`. La matriz prueba que **no** se borra con: sin cabecera, token inventado, token revocado por `POST /account/logout`, token válido en `?token=`, token válido en una cookie y sesión del guard `web` (`withGuard('web').loginAs(...)`). En todos: `401 { errors: [{ message: 'Unauthorized access' }] }` y la tarea sigue.

**Razón**: R1 (S-1) y R2 (T-5). El CSRF de `shield` está apagado (`config/shield.ts`), así que la defensa contra que otra web borre en nombre de alguien es que el navegador **no** adjunta por su cuenta una cabecera `Authorization`; el test lo fija para que nadie la rompa activando una vía por cookie.

**Alternativas descartadas**: *activar CSRF*: con un bearer en cabecera no protege nada más y toca configuración compartida. *Un `confirm: true` en el cuerpo*: no es un control (E-1, R10); el modelo de amenazas lo descarta explícitamente.

## 5. Una petición, una tarea

**Decisión**: no existe `DELETE /api/v1/tasks` (colección). El test lo fija: `DELETE /api/v1/tasks` y `DELETE /api/v1/tasks?status=pending` responden `404` y quedan las N tareas; un `DELETE /api/v1/tasks/:id` con un cuerpo `{ ids: [...] }` borra solo `:id` (N−1) porque la acción no lee el cuerpo.

**Razón**: R3 (T-1), FR-017. El `404` de una ruta inexistente lo da el router (`E_ROUTE_NOT_FOUND`), con un cuerpo que no controla este cambio: el test asserta el código y el recuento, no la forma de ese cuerpo.

## 6. CORS: `DELETE` ya está permitido

**Decisión**: **no hace falta tocar `backend/config/cors.ts`**. Comprobado:

- `methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']` → `DELETE` está en la lista que responde el preflight.
- `headers: true` → refleja las cabeceras pedidas, incluida `Authorization`.
- `origin: app.inDev ? true : []` → en desarrollo cualquier origen (la SPA en `:5173`); en producción ninguno hasta configurarlo, que es operación del despliegue (modelo de amenazas §5).
- `credentials: true` solo importaría con cookies, y el borrado no las usa (§4).

## 7. Que la aplicación no se pueda incrustar

**Decisión**: dos piezas.
1. **API**: ya responde `X-Frame-Options: DENY` (`xFrame` de `config/shield.ts`). La matriz lo fija en la respuesta del `DELETE`.
2. **SPA**: `frontend/vite.config.ts` gana `server.headers` y `preview.headers` con `X-Frame-Options: DENY` y `Content-Security-Policy: frame-ancestors 'none'`, y nada más en esa CSP. El e2e de US3-4 carga la SPA dentro de un `<iframe>` y comprueba que no se pinta.

**Razón**: R6 (T-4), FR-020. Clickjacking sobre «Borrar» → «Borrar definitivamente» es justo el ataque que esta historia abre. Vite no envía cabeceras por defecto. Una CSP con solo `frame-ancestors` no restringe scripts ni estilos, así que no rompe nada ni entra en la «CSP de la SPA» que el modelo de amenazas deja fuera (S-2). El servidor de producción no está en el repo: allí se comprueba en el despliegue, como dice la spec.

**Alternativas descartadas**: *un `<meta http-equiv>` en `index.html`*: `frame-ancestors` y `X-Frame-Options` se ignoran en `<meta>`. *Dejarlo todo al despliegue*: FR-020 quedaría sin ningún test en el repo.

## 8. El diálogo de confirmación: `<dialog>` nativo compuesto con `Button`

**Decisión**: no hay componente de diálogo en `frontend/src/components/ui/` (solo `alert`, `button`, `card`, `input`, `label`). Como pide el input, se construye un componente propio `frontend/src/components/tasks/delete-task-dialog.tsx` sobre el elemento **`<dialog>` nativo** abierto con `showModal()`, compuesto con `Button` de `ui/`. Detalles:

| Necesidad | Cómo |
|---|---|
| Bloquea el resto (US1-4) | `showModal()`: el resto del documento queda inerte y el diálogo en la *top layer*; el test lo comprueba con `dialog.matches(':modal')`. |
| Nombre y descripción accesibles | `aria-labelledby` → el título (`h2`), `aria-describedby` → la frase de irreversibilidad. El rol `dialog` y el carácter modal los da el elemento. |
| Foco inicial en «Cancelar» (FR-009) | Tras `showModal()`, `cancelRef.current.focus()` explícito (el `autoFocus` de React no es fiable con un `<dialog>` que se abre después del montaje). |
| Foco atrapado (FR-016) | `onKeyDown` en el diálogo: Tab en el último control → al primero; Mayús+Tab en el primero → al último. Con dos botones es trivial y no depende de que Chromium mande el foco a la barra del navegador al salir del documento. |
| Escape cancela (FR-008) | Evento `cancel` del `<dialog>`: `preventDefault()` y cierre por el estado de React, para que React sea la única fuente de verdad de si está abierto. |
| Clic fuera cancela (FR-008) | El `<dialog>` va sin padding y todo su contenido dentro de un `div`: un `click` cuyo `target` es el propio `<dialog>` solo puede venir del *backdrop*. |
| Devolver el foco (FR-008) | Al cerrar sin borrar, foco al botón «Borrar tarea» que lo abrió (se guarda su ref, no se confía en la restauración del navegador). |
| Centrado | El *preflight* de Tailwind v4 pone `margin: 0` a todo y descentra el `<dialog>` modal: lleva `m-auto`. |

**Razón**: el input lo fija («si el componente de diálogo de shadcn no está instalado, se usa el elemento `<dialog>` nativo o se compone con lo que ya hay»), y el nativo trae gratis lo más difícil de hacer bien a mano: la inercia del resto de la página y la *top layer*. Ninguna dependencia nueva.

**Alternativas descartadas**:
- *`npx shadcn add dialog`*: `radix-ui` ya está instalado, así que no añadiría dependencia (modelo de amenazas §2), pero el input pide expresamente no traerlo en este cambio.
- *Un `div` con `role="dialog"` y overlay propio*: habría que reimplementar la inercia del fondo (`inert` en hermanos) y el apilamiento; más código y más superficie de fallo que el nativo.
- *`window.confirm()`*: no deja nombrar la acción («Aceptar» genérico, contra US1-6), ni poner el foco en cancelar, ni aplicar DESIGN.md.

## 9. Un doble clic o un Enter de más no confirman (FR-010)

**Decisión**: el diálogo nace **desarmado** durante `CONFIRM_GUARD_MS = 500` ms (un `setTimeout` que pone `armed = true`). Mientras está desarmado se ignoran las activaciones de sus dos botones y el clic en el *backdrop*; **Escape cancela siempre**. Los botones no se deshabilitan (seguirían sin poder recibir el foco): simplemente la activación no hace nada.

**Razón**: el gesto repetido cae siempre **dentro** del diálogo recién abierto:
- *Doble clic* sobre «Borrar tarea»: el segundo clic cae en el *backdrop* o en un botón del diálogo, según dónde quede; sin la guarda cancelaría (o, peor, confirmaría) en vez de dejar la pregunta abierta (US2-3).
- *Enter, Enter*: el primero abre y pone el foco en «Cancelar»; el segundo activaría «Cancelar» y cerraría la pregunta, y US2-3 dice que debe seguir abierta.

500 ms cubre el umbral de doble clic por defecto de los sistemas de escritorio y el retardo típico de repetición de tecla, y queda por debajo de lo que tarda una persona en leer la pregunta, así que no estorba al gesto deliberado. Un `setTimeout` (y no `performance.now()` comparado a mano) deja que los e2e controlen el tiempo con `page.clock` (§15).

**Alternativas descartadas**: *ignorar clics con `event.detail > 1`*: no cubre el teclado (`detail` es 0 con Enter). *Deshabilitar los botones*: un botón deshabilitado no puede tener el foco inicial (FR-009).

## 10. Qué pasa al confirmar

**Decisión**: una sola petición en vuelo (un `ref`); mientras dura, el botón dice «Borrando…» y el diálogo ignora cancelar, Escape y el *backdrop* (la petición ya salió: cerrar sería mentir sobre el resultado). Luego:

| Respuesta | Qué ve el miembro |
|---|---|
| `204` | `navigate(destino, { replace: true, state: { deletedTaskTitle } })` a **la vista de la que vino** —el tablero si llegó desde él (`location.state.from === 'board'`, como `BackToList`), si no la lista—, que muestra «Se ha borrado «título».» sin «Deshacer» (§11). `replace` para que «Atrás» no vuelva a una tarea que ya no existe. |
| `404` | El diálogo se cierra y la página pasa al estado `not-found` que **ya existe** en `task-page.tsx`: `Alert` por defecto (no destructiva) «Esta tarea ya no existe» + «Puede que alguien la haya borrado.» (el mensaje de `taskNotFound` de `lib/api.ts`). El foco va a «Volver a la lista/al tablero». |
| `401` | El diálogo sigue abierto con el mensaje de `lib/api.ts`: «Tu sesión ha caducado. Vuelve a iniciar sesión.». La tarea sigue a la vista. |
| Fallo de red u otro | El diálogo sigue abierto con «No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.» (`role="alert"`); la tarea sigue a la vista y se puede volver a confirmar o cancelar. |

**Razón**: FR-005, FR-006, FR-007, FR-014 y US1-8. Sin actualización optimista: borrar es irreversible y la spec prohíbe presentar como borrada una tarea que no se borró. El estado `not-found` ya cumple US2-6 y ya tiene el tono acordado en E2-5. El destino «de donde vino» es lo que dice la spec (Assumptions); el input dice «vuelta a la lista», que es el caso por defecto.

## 11. El aviso de «tarea borrada» en la lista y en el tablero

**Decisión**: componente propio `frontend/src/components/tasks/task-deleted-notice.tsx`, usado por `tasks-page.tsx` y `board-page.tsx`. Lee `location.state.deletedTaskTitle` **una vez** al montar (un `ref`, como ya hacen con `focusTaskId`) y en seguida lo borra del historial (`navigate(location, { replace: true, state: null })`) para que recargar no lo repita. Pinta `<p role="status" tabIndex={-1}>Se ha borrado «título».</p>` con `text-muted-foreground` y recibe el foco al montar, así el lector de pantalla lo lee y el teclado sigue desde arriba de la vista. No ofrece «Deshacer» ni enlace alguno (FR-006). No nombra a nadie (FR-021).

**Razón**: un `role="status"` que se monta ya con contenido no siempre se anuncia; darle el foco lo garantiza, y el foco que estaba en el diálogo no tiene a dónde volver (la tarea ya no existe). Un componente compartido evita dos versiones del mismo texto.

**Alternativas descartadas**: *un toast*: no hay componente ni dependencia, y desaparecer solo es malo para quien lee despacio. *Guardar el aviso en `TasksLayout`*: obligaría a ampliar el contexto del filtro (`use-task-filter.ts`) para algo de un solo uso.

## 12. Cuánto cuesta borrar frente a cambiar de estado (FR-011)

**Decisión**: con la definición de interacción de E2-4 (una activación deliberada):

| Gesto, desde la lista o el tablero | Interacciones |
|---|---|
| Cambiar el estado | 2 (abrir el control y elegir) |
| Borrar | **3** (abrir la tarea, «Borrar tarea», «Borrar definitivamente») |

Ni la fila de la lista ni la tarjeta del tablero llevan acción de borrar, así que no comparten control ni posición con el cambio de estado (FR-011, FR-012) por construcción. Los e2e lo fijan: no hay ningún botón «Borrar» en la lista ni en el tablero.

## 13. Textos

Castellano, cortos y con la acción (DESIGN.md, RNF-8). Fijados en el [contrato de interfaz](./contracts/delete-task-ui.md#textos):

| Dónde | Texto |
|---|---|
| Botón en la tarea abierta | «Borrar tarea» |
| Título del diálogo | «¿Borrar «{título}»?» |
| Descripción | «Se borrará para todo el equipo y no se podrá recuperar: no hay papelera ni forma de deshacerlo.» |
| Opción que no borra | «Cancelar» |
| Opción que borra | «Borrar definitivamente» (mientras se envía: «Borrando…») |
| Tras borrar | «Se ha borrado «{título}».» |
| Ya no existe | «Esta tarea ya no existe» + «Puede que alguien la haya borrado.» (existentes) |
| Fallo | «No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.» |
| Sin sesión | «Tu sesión ha caducado. Vuelve a iniciar sesión.» (existente) |

El título va completo, con `wrap-break-word`, y el cuerpo del diálogo hace scroll si no cabe (edge case de título muy largo). Ningún texto nombra a quien creó, lleva o borró la tarea (US1-3, FR-021).

## 14. Tests del backend (Japa)

**Decisión**: `backend/tests/functional/tasks/delete_task.spec.ts`, nuevo, escrito y ejecutado en **rojo** antes de la ruta y la acción. Aislado con `group.each.setup(() => testUtils.db().truncate())`, como el resto de `tasks/`. Aserciones contra el cuerpo completo (`assert.deepEqual(response.body(), …)`) y, en el `204`, cuerpo vacío (`response.text() === ''`). «Tarea intacta» = releer `status`, `title`, `assigneeId`, `dueDate` y `updatedAt`. Los ids de los casos de forma (`01`, `1.0`, …) se construyen a partir del id real de la tarea creada, nunca con números fijos, porque `truncate` no garantiza reiniciar la secuencia. Matriz completa en el [contrato del API](./contracts/delete-task-api.md#matriz-de-comportamiento-definition-of-done).

**Ojo**: la suite functional hace `truncate` sobre la **misma** SQLite que el servidor de desarrollo y los e2e (CLAUDE.md; modelo de amenazas §5). No se corre `npm test` en `backend/` a la vez que `npm run test:e2e`.

## 15. Tests e2e (Playwright)

**Decisión**: `frontend/e2e/delete-task.spec.ts`, nuevo, escrito y visto en **rojo** antes de tocar el frontend. Un test por escenario de interfaz, titulado como el escenario (`US1-1 · DADO …, CUANDO …, ENTONCES …`), más un test de axe con el diálogo abierto. Técnicas:

- **Tiempo de la guarda (§9)**: `page.clock.install()` antes de `goto`. Los gestos deliberados hacen `page.clock.fastForward(500)` tras abrir el diálogo; los de doble activación (US2-2, US2-3) hacen `page.clock.pauseAt(...)` antes del gesto para que la guarda no caduque a mitad del test.
- **«No se ha intentado borrar»**: se cuentan las peticiones con `page.on('request')` filtrando `method() === 'DELETE'`; tiene que ser 0.
- **«Sin recargar»**: una marca en `window` antes de confirmar que sigue ahí después.
- **Datos**: cada test crea sus miembros y tareas con títulos únicos (BD compartida). Helpers nuevos en `frontend/e2e/support.ts`: `deleteTask(request, member, id)` (por la API, espera `204`), `logOut(request, member)` (`POST /account/logout`) y `getTaskStatus(request, member, id)` (código de `GET /tasks/:id`, para comprobar que una tarea sigue o ya no está).
- **Fallo de red**: `page.route` que aborta solo el `DELETE`.

## 16. Diseño

**Decisión**: solo tokens semánticos. Diálogo: `bg-card text-card-foreground border rounded-xl` con `p-6` en el contenido, `max-w-md w-[calc(100%-2rem)]`, *backdrop* `backdrop:bg-background/80` (el overlay que usaba shadcn antes de pasar a `bg-black`, que es paleta). «Borrar tarea» y «Borrar definitivamente» con `Button variant="destructive"`; «Cancelar» con `variant="outline"` y el **mismo tamaño** (US1-6: igual de visible). Sin sombras nuevas. **Ningún token nuevo**, así que `index.css` no cambia; DESIGN.md gana en «Components» el patrón **Confirmación destructiva** (sin valores), para que la próxima acción irreversible lo reutilice.

**Razón**: Principio VI y DESIGN.md (`destructive` = acciones destructivas; plano, sin sombras marcadas).

## 17. Dónde el plan se aparta del input, y por qué

1. **Tras borrar se vuelve a la vista de la que se vino**, no siempre a la lista: si se abrió la tarea desde el tablero, se vuelve al tablero. Es lo que dice la spec (Assumptions) y lo que ya hace «Volver» en `task-page.tsx`; desde la lista, que es el caso por defecto, se vuelve a la lista como pide el input.
2. **`frontend/vite.config.ts` cambia** (§7): sin las cabeceras de *framing* en el servidor de Vite, FR-020/US3-4 no tendría ningún test en el repo.
3. **`tasks-page.tsx` y `board-page.tsx` cambian** para pintar el aviso de borrado (§11); y DESIGN.md gana un patrón (§16).
4. **Se edita `spec.md`** solo para cerrar el `[NEEDS CLARIFICATION]` de FR-012 con la decisión del input (sección «Clarifications»).
