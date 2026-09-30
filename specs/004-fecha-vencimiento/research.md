# Research: Fecha de vencimiento y tareas vencidas

Decisiones técnicas de FS-118. Cada una se ha contrastado con los `.d.ts` y el código real de `backend/node_modules/` (AdonisJS 7, Lucid 22, VineJS 4), no con documentación de versiones anteriores.

## 1. Columna `due_date` de tipo `date`, nullable, sin default

- **Decision**: migración nueva `add_due_date_to_tasks` (`node ace make:migration add_due_date_to_tasks`) con `this.schema.alterTable('tasks', …)`: `up` añade `table.date('due_date').nullable()` sin default; `down` hace `table.dropColumn('due_date')`.
- **Rationale**: la spec define la fecha como día natural sin hora ni zona (Clarifications 2026-09-30). `date` guarda exactamente eso. Nullable porque «sin fecha» es el estado por defecto y normal (RF-13, FR-001); sin default para que las tareas existentes queden sin fecha al migrar y no reciban un valor inventado.
- **Alternatives considered**: `datetime`/`timestamp` — obliga a elegir una hora y una zona que el producto no tiene, y reabre el error del día de más (una medianoche UTC es el día anterior en América). `string` — pierde el tipo en el esquema generado y la validación de la base.

## 2. Lo que genera `schema.ts` para `date`

- **Decision**: no se edita `backend/database/schema.ts`; `node ace migration:run` lo regenera. El generador de Lucid (`src/orm/schema_generator/mappings.js` y `rules.js`) mapea `date` → `@column.date()` con tipo `DateTime` de Luxon, y la nulabilidad → `DateTime | null`. `TaskSchema` ganará `declare dueDate: DateTime | null`, y `Task` la hereda sin redeclararla.
- **Rationale**: principio III y BOUNDARIES.md; el modelo solo añade lógica.
- **Alternatives considered**: declarar la columna en el modelo — prohibido por la convención del repo (el modelo no declara columnas).

## 3. La regla vive en `Task.isOverdueOn(today)`

- **Decision**: método de instancia `isOverdueOn(today: DateTime): boolean` en `app/models/task.ts`:
  `dueDate !== null && dueDate.toISODate()! < today.toISODate()! && status !== 'done'`.
  La comparación es entre cadenas `AAAA-MM-DD`, que ordenan lexicográficamente igual que cronológicamente.
- **Rationale**: compara días naturales, nunca instantes: ni la hora ni la zona del proceso pueden sumar o restar un día (CA-5, el borde «mismo día»). Un solo sitio, que el transformer consume y ninguna otra capa reimplementa (FR-010).
- **Alternatives considered**: comparar `DateTime` con `<` — compara milisegundos, así que depende de la hora y la zona con que Lucid y Luxon construyan cada valor. `startOf('day')` en ambos lados — funciona solo si los dos están en la misma zona, y eso es justo lo que no se puede garantizar.

## 4. El día de referencia: `today` en la query, con respaldo UTC

- **Decision**: `GET /api/v1/tasks/:id` y `PUT /api/v1/tasks/:id/due-date` aceptan `?today=AAAA-MM-DD` opcional. Se valida con un validador propio sobre la query (`request.validateUsing(todayQueryValidator, { data: request.qs() })`; `validateUsing` acepta `data`, comprobado en `@adonisjs/core`). Si no llega, `today = DateTime.utc()`. El frontend lo envía **siempre**.
- **Rationale**: FR-011 y CA-19/CA-20: el «hoy» es el de quien mira, que solo conoce el navegador. Se decide en cada petición, así que una tarea vence sola al cruzar la medianoche (CA-20). Opcional para que cualquier cliente que hoy llama a `GET /tasks/:id` sin query siga funcionando.
- **Validación sobre `request.qs()` y no sobre `request.all()`**: así `today` solo se lee de la query, y un `today` metido en el cuerpo del `PUT` no se trata como día de referencia.
- **`today` mal formado → `422`** con el formato de error de VineJS, campo `today`. Ignorarlo en silencio y caer al UTC escondería un fallo del cliente y daría lecturas erróneas sin que nadie lo notara.
- **Alternatives considered**: huso en una cabecera o guardado por usuario — introduce estado que la spec no pide (no hay ajuste por persona). Calcular la señal en el frontend — la regla quedaría en dos sitios.

## 5. Validación de `dueDate` con VineJS 4

- **Decision**: en `app/validators/task.ts`:
  - `updateTaskDueDateValidator = vine.create({ dueDate: vine.date({ formats: ['YYYY-MM-DD'] }).nullable() })`
  - `todayQueryValidator = vine.create({ today: vine.date({ formats: ['YYYY-MM-DD'] }).optional() })`
- **Comprobado en el código de VineJS** (`build/index.js`, `dateRule`; `helpers.asDayJS`):
  - parsea con `dayjs(value, formats, true)`, en **modo estricto**, así que `2026-02-31`, `30/09/2026`, `2026-9-3` y cualquier texto dan fecha inválida;
  - no admite ISO suelto salvo que se pida el formato `iso`, así que `2026-09-30T10:00:00Z` también se rechaza;
  - el error es `{ message: 'The dueDate field must be a datetime value', rule: 'date', field: 'dueDate' }`, sin `meta`;
  - `null` pasa por `.nullable()`; la clave ausente da `required` (`The dueDate field must be defined`).
- **Rationale**: FR-006/FR-007: cualquier fecha real se acepta, también las pasadas y sin tope de años; solo lo imposible o mal formado se rechaza. Al rechazarse en la validación, la tarea no se toca y conserva su fecha.
- **Conversión** *(corregido al implementar, T020)*: `start/validator.ts`, en la base del repo, registra `VineDate.transform((value) => DateTime.fromJSDate(value))`. Por eso `vine.date()` ya devuelve un `DateTime` de Luxon en la zona local del proceso, y el controlador usa el valor tal cual (`task.merge({ dueDate })`, `today ?? DateTime.utc()`). La primera versión volvía a aplicar `DateTime.fromJSDate()` sobre un `DateTime` y daba 500. El día se conserva porque dayjs parsea y Luxon convierte en la misma zona local, así que `toISODate()` devuelve el mismo `AAAA-MM-DD` que llegó. No se usa `toISOString()` en ningún punto (daría el día UTC).
- **Límite conocido** *(hallado en la revisión, decidido en el plan)*: el parseo estricto de dayjs rechaza los años `0001`–`0099` (los trata como años de dos cifras), mientras que `0100`–`9999` se aceptan. Los años de más de cuatro cifras no son `AAAA-MM-DD`, así que por definición del contrato están mal formados. La spec deja al plan qué es una fecha «mal formada» (Assumptions), y se acepta así: sortearlo exigiría un validador propio para fechas que ningún compromiso real usa. Si se quiere cerrar, es un cambio aparte.
- **Alternatives considered**: `vine.string().regex(...)` — deja pasar `2026-02-31` sin una regla a mano.

## 6. Transformer del detalle con `today` como argumento

- **Decision**: `TaskDetailTransformer` recibe `today` por constructor (`constructor(resource: Task, protected today: DateTime)`). `BaseTransformer.transform(data, ...rest)` reenvía argumentos extra al constructor (comprobado en `@adonisjs/http-transformers/build/src/base_transformer.d.ts`). Uso: `TaskDetailTransformer.transform(task, today)`. Añade:
  - `dueDate: this.resource.dueDate?.toISODate() ?? null`
  - `isOverdue: this.resource.isOverdueOn(this.today)`
- **Rationale**: `this.pick` serializaría el `DateTime` como instante ISO con hora y zona (`2026-09-30T00:00:00.000+02:00`); la spec pide un día. `isOverdue` se calcula, nunca se guarda (Key Entities: «no es un dato que se guarde»).
- **`TaskTransformer` (lista) no cambia**: ni `dueDate` ni `isOverdue` (FR-015, CA-11). Tampoco `PATCH /tasks/:id/status`, que usa el de la lista.

## 7. `PUT /api/v1/tasks/:id/due-date` en un controlador propio

- **Decision**: `app/controllers/task_due_dates_controller.ts`, acción `update`, dentro del grupo `tasks` con `middleware.auth()`: `router.put(':id/due-date', [controllers.TaskDueDates, 'update'])`. Orden: sesión (`401`) → cuerpo y query (`422`) → existencia (`404`) → guardar (`200`), igual que `TaskStatusesController`.
- **Rationale**: mismo patrón que E2-4 (un recurso hijo, un controlador). `PUT` porque el cuerpo reemplaza el valor completo de la fecha, `null` incluido. `200` con el detalle para que la vista pinte la fecha y la señal con lo guardado, sin otra petición (FR-004).
- **Alternatives considered**: `PATCH /tasks/:id` genérico — abriría la puerta a editar título y responsable, que son otras historias. `DELETE /tasks/:id/due-date` para quitar — un segundo endpoint para lo que `null` ya expresa.

## 8. ⚠️ Impacto sobre `GET /api/v1/tasks/:id` y sus tests existentes

Este punto necesita **visto bueno humano explícito** antes de `/speckit-tasks`; ver el Constitution Check del plan.

- **Hechos**:
  1. `BOUNDARIES.md` prohíbe «cambiar una ruta pública existente bajo `/api/v1` (path, verbo o **forma de la respuesta**)», y dice que prevalece sobre cualquier prompt. Añadir `dueDate` e `isOverdue` al detalle cambia la forma de su respuesta, aunque sea de forma aditiva. Aceptar `?today` añade además una rama `422` que antes no existía.
  2. `backend/tests/functional/tasks/show_task.spec.ts` aserta el **cuerpo completo** con `deepEqual` en 6 tests. El test «el detalle coincide con la fila de esa tarea en la lista» fija justo el invariante que esta historia rompe a propósito. Esos 7 tests fallarán en cuanto el detalle lleve campos nuevos.
- **Decisión propuesta (la de la entrada del plan)**: tratarlo como **cambio de contrato deliberado** de un endpoint que solo consume el frontend de este repo:
  - se actualizan las expectativas de `show_task.spec.ts` (`expectedBody` gana `dueDate: null, isOverdue: false`; el test de «coincide con la lista» pasa a comprobar que el detalle es la fila **más** `dueDate` e `isOverdue`, y que la fila no los tiene);
  - se hace en la fase roja, **antes** de tocar el transformer: los tests actualizados fallan contra el código actual y pasan después. Es un test de cambio de comportamiento, no un test editado para que pase;
  - va en su propio commit, citado en el PR, para que el `adversarial-reviewer` y quien revise lo vean aislado.
- **Alternativa que no toca nada existente**: servir la fecha y la señal en una ruta **nueva** (`GET /api/v1/tasks/:id/due-date` devolviendo `{ dueDate, isOverdue }`), dejando `GET /tasks/:id` y `show_task.spec.ts` intactos. Cumple la valla al pie de la letra, a cambio de una segunda petición al abrir la tarea y de un tercer transformer.
- **Por qué no se decide aquí**: la constitución (III) no deja que un plan amplíe la valla; decide un humano.

## 9. Frontend: tipos y llamadas a la API

- **Decision**: en `frontend/src/lib/types.ts`, un tipo nuevo `TaskDetail = Task & { dueDate: string | null; isOverdue: boolean }`, espejo de `TaskDetailTransformer`; `Task` (lista) no cambia. `getTask(id, token)` pasa a devolver `TaskDetail` y envía `?today=`. Función nueva `setDueDate(id, dueDate, token): Promise<TaskDetail>` (`PUT`, cuerpo `{ dueDate }`, `?today=`), con el mismo trato del `404` que `updateTaskStatus`.
- **`today` local**: helper `localToday()` que compone `AAAA-MM-DD` con `getFullYear()`/`getMonth()`/`getDate()`. **Nunca** `toISOString().slice(0, 10)`, que da el día UTC y reintroduce el fallo del huso.
- **Errores**: `translate()` gana `case 'date'` («Esa fecha no existe. Escríbela completa, con día, mes y año.») y `FIELD_LABELS.dueDate = 'la fecha de vencimiento'`. `fieldErrors.dueDate` se pinta junto al campo, como hacen los formularios de auth.

## 10. Frontend: el campo de fecha y cuándo guarda

- **Decision**: `<Input type="date">` (el componente `ui/input` existente; sin dependencias nuevas). Guarda sin botón:
  - al **salir del campo** (`blur`) o pulsar **Enter**, si el valor es una fecha completa distinta de la guardada;
  - si el campo queda **vacío del todo** → `setDueDate(id, null)`: es quitar la fecha (FR-005);
  - si el navegador marca el valor como **a medio escribir** (`input.validity.badInput === true`, con `value === ''`) → **no** se llama a la API: se muestra el mismo mensaje de `case 'date'` en el hueco de error del campo y se restaura el valor guardado (FR-007, CA-14);
  - un botón «Quitar fecha» (`ui/button`, variante secundaria), visible solo si hay fecha, que llama a `setDueDate(id, null)` sin confirmación.
- **Rationale**: con un `input type="date"` nativo, el evento `change` de React salta con cada fecha completa **mientras se escribe el año** (0002 → 0020 → 0202 → 2026). Guardar en cada cambio persistiría años intermedios y dispararía peticiones en carrera. Guardar al salir del campo o con Enter sigue sin tener paso de guardado (CA-16). Y `badInput` es la única forma de distinguir «vacío» de «a medio escribir» en un campo nativo, que en ambos casos devuelve `value === ''`.
- **Desviación consciente de la entrada** («guarda al cambiar»): se guarda al confirmar el valor, no con cada cambio de tecla. Si se prefiere guardar al cambiar, hay que aceptar los años intermedios o añadir un retardo, que tiene su propio fallo (se guarda lo que haya al hacer pausa).
- **Optimista con marcha atrás**: la vista muestra la fecha nueva al instante y, si la petición falla (fuera del `422`), vuelve a la guardada y explica que no se pudo guardar (FR-008), con el mismo patrón de E2-4.

## 11. La señal «Vencida»

- **Decision**: cuando `isOverdue` es `true`, un texto «Vencida» junto a la fecha, dentro del mismo `<dd>`, con los tokens de color de error ya definidos en `src/index.css` y un peso de letra distinto. El texto es la señal y el color solo la refuerza (FR-013, RNF-6). No cuenta días ni hay avisos intermedios (Clarifications 2026-09-30). Sin fecha → «Sin fecha» en el tono apagado ya usado para las etiquetas, sin aviso (FR-016).
- **Alternatives considered**: un componente `Badge` de shadcn — no está en `components/ui/` y traerlo es un cambio aparte; un `Alert` — demasiado ruido para un dato de la tarea.

## 12. Tests: orden y forma

- **Decision**: funcionales Japa en `backend/tests/functional/tasks/`, escritos y ejecutados **en rojo antes** que la implementación (principio II). `update_task_due_date.spec.ts` para la matriz del `PUT`; `task_overdue.spec.ts` para la regla por sus bordes a través de `GET /tasks/:id?today=…`; y la comprobación de la lista en `list_tasks.spec.ts`, como test **nuevo** (no se edita ninguno de sus tests actuales). Aislamiento con `group.each.setup(() => testUtils.db().truncate())`, como el resto. `today` siempre explícito en los tests de la regla, para no depender del reloj ni de la zona del proceso.
- **Cuerpo completo**: `assert.deepEqual(response.body(), …)` en todas las ramas, más la relectura en base de datos (`dueDate`, `status`, `title`, `assigneeId`) para demostrar qué se guardó y qué no.
- **Sin test unitario aparte de `isOverdueOn`**: la regla se prueba por la API, con `today` controlado, que es como la ve el usuario. Si `/speckit-tasks` quiere además un unitario, cabe en la suite `unit` ya declarada en `adonisrc.ts`.

## 13. Código generado que se commitea

- `backend/database/schema.ts`, regenerado por `node ace migration:run`.
- `backend/.adonisjs/server/controllers.ts` (entra `TaskDueDates`) y `backend/.adonisjs/client/registry/` (ruta nueva y `today` en `tasks.show`), regenerados al arrancar el servidor o correr los tests.
- Nada de esto se edita a mano.

## 14. Zona vallada y dependencias

- No se toca ningún archivo de la lista «Nunca» de `BOUNDARIES.md` (controladores, middleware, validador y modelo de auth, migraciones de `users` y `access_tokens`, `frontend/src/auth/`).
- Ninguna dependencia nueva: Luxon ya está en `backend/package.json`; el `input type="date"` es nativo.
