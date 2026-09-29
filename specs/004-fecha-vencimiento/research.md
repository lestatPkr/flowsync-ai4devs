# Research: Fecha de vencimiento y tareas vencidas

Phase 0 de `/speckit-plan`. Cada decisión se ha contrastado contra el código real del repo (lo que dejaron E2-1, E2-4 y E2-5) y contra el código instalado en `backend/node_modules/` (AdonisJS 7.3, Lucid 22.4, VineJS 4.4, `@adonisjs/http-transformers`), no contra documentación de versiones anteriores. Las rutas de fichero citadas son las de `node_modules/` en el momento de escribir esto.

## 1. Columna: `date`, nullable, sin default

- **Decision**: migración nueva `node ace make:migration add_due_date_to_tasks` que hace `this.schema.alterTable('tasks', (table) => { table.date('due_date').nullable() })` en `up()` y `table.dropColumn('due_date')` en `down()`. Sin `defaultTo`. `node ace migration:run` regenera `database/schema.ts`, que pasa a declarar en `TaskSchema` `@column.date() declare dueDate: DateTime | null`. El modelo `Task` **no** redeclara la columna.
- **Rationale**:
  - **`date` y no `datetime`**: la fecha de vencimiento es un día del calendario, el mismo escrito para todos (spec, Key Entities y Assumptions). Un `datetime` guarda un instante: «el 30 a las 00:00 UTC» es el 29 por la tarde en América, y la fecha escrita cambiaría según quién mira, que es justo lo que la spec prohíbe. Con `date` no hay hora ni huso que convertir.
  - **Nullable**: «sin fecha» es un estado normal (FR-001) y el camino por defecto al crear (FR-002). Las tareas existentes quedan con `NULL` y siguen válidas (FR-022).
  - **Sin default**: cualquier default (p. ej. hoy + 7) sería sugerir una fecha, que CA-1 prohíbe.
  - Lucid 22 mapea `date` a `INTERNAL_TYPES.DATE` → `tsType: 'DateTime'` con `@column.date` (`@adonisjs/lucid/build/src/orm/schema_generator/rules.js`), y la nulabilidad de la columna añade `| null` (igual que `updatedAt`). El decorador `column.date` (`orm/decorators/date.js`) persiste con `value.toISODate()` → `'AAAA-MM-DD'` en SQLite y consume con `DateTime.fromSQL(value)`: el día guardado es exactamente el día enviado.
- **Alternatives considered**:
  - `datetime`/`timestamp` a medianoche — el problema de husos de arriba.
  - `string` con el texto `'AAAA-MM-DD'` — pierde el tipo `DateTime` en el modelo y obliga a validar el formato también al leer.
  - Guardar una columna `is_overdue` — la condición depende del día de quien mira y del paso del tiempo (FR-012, FR-013); una columna quedaría congelada al guardar (lo que CA-20 prohíbe).

## 2. La regla vive en el dominio: `Task.isOverdueOn(today)`

- **Decision**: en `app/models/task.ts`, un método de instancia

  ```ts
  isOverdueOn(today: DateTime): boolean
  ```

  que devuelve `true` si y solo si `this.dueDate !== null`, `this.status !== 'done'` y el día de `this.dueDate` es estrictamente anterior al día de `today`. La comparación se hace por **día natural**, comparando `toISODate()` de ambos (`'AAAA-MM-DD'` contra `'AAAA-MM-DD'`), sin horas. Ninguna otra capa (transformer, controlador, frontend) reimplementa la regla: el transformer llama al método y el frontend solo pinta el booleano.
- **Rationale**: una sola fuente de verdad para RF-14 / FR-011. Comparar `toISODate()` y no `DateTime` con `<` evita el error clásico de husos: `dueDate` sale de `DateTime.fromSQL` en la zona local del servidor y `today` puede venir en otra (UTC por defecto, §4); `startOf('day')` en zonas distintas no son el mismo día. `toISODate()` devuelve el día de calendario en la zona propia de cada `DateTime`, que es el día que se escribió. La comparación lexicográfica de `'AAAA-MM-DD'` es correcta porque ambos tienen ancho fijo y el año va de 1000 a 9999 (§5).
- **Alternatives considered**:
  - Un getter `isOverdue` sin parámetro — obligaría a leer «hoy» del reloj del servidor dentro del modelo, contradiciendo CA-19 (el día lo pone quien mira).
  - Calcular en el frontend a partir de `dueDate` — dos implementaciones de la regla y la lógica de negocio fuera del dominio (el input lo prohíbe).
  - `this.dueDate < today.startOf('day')` — falla cuando las zonas no coinciden (arriba).
  - Un servicio aparte (`app/services/`) — una regla de tres condiciones sobre campos de la propia tarea pertenece a la entidad.

## 3. El día de referencia lo pone quien mira: `?today=AAAA-MM-DD`

- **Decision**: `GET /api/v1/tasks/:id` y el nuevo `PUT /api/v1/tasks/:id/due-date` aceptan un parámetro de consulta **opcional** `today` (`AAAA-MM-DD`). El frontend lo envía **siempre**, calculado en el momento de cada petición con la fecha **local** del navegador (`getFullYear()`, `getMonth() + 1`, `getDate()`, con ceros a la izquierda; **nunca** `toISOString()`, que da el día UTC). Sin `today`, el servidor usa `DateTime.utc()` y así queda escrito en el contrato.
- **Rationale**: hace verdad CA-19 (dos husos, dos lecturas correctas) sin preferencia de huso por persona (supuesto de la spec: el día sale del dispositivo). Como el día se calcula en cada petición y la condición en cada respuesta, CA-20 se cumple solo: al reabrir o recargar después de la medianoche, `today` ya es otro. Opcional para no romper el contrato existente de `GET /tasks/:id`: quien lo llame como en E2-5 sigue obteniendo `200` con los mismos campos de antes, más los dos nuevos. `DateTime.utc()` como fallback es determinista y no depende del `TZ` del proceso.
- **Alternatives considered**:
  - Mandar el huso (`?tz=Europe/Madrid`) y que el servidor calcule el día — añade la base de husos IANA a la ecuación y un segundo formato que validar, para obtener lo mismo que ya sabe el navegador.
  - Cabecera propia (`X-Client-Date`) — menos visible, no aparece en el registro Tuyau de la ruta y complica CORS (`headers: true` lo permitiría, pero no aporta nada frente a la query).
  - `today` obligatorio — rompería a cualquier cliente de `GET /tasks/:id` que no lo mande (BOUNDARIES.md: la ruta existente no cambia).
  - Fallback a la hora local del servidor — depende de `TZ`, que es configuración, no dato.

## 4. Validar la query por separado del cuerpo

- **Decision**: dos validadores en `app/validators/task.ts`, cada uno aplicado **solo** a su fuente:
  - `updateTaskDueDateValidator = vine.create({ dueDate: calendarDay().nullable() })`, con `request.validateUsing(updateTaskDueDateValidator, { data: request.body() })`.
  - `taskReadingDayValidator = vine.create({ today: calendarDay().optional() })`, con `request.validateUsing(taskReadingDayValidator, { data: request.qs() })`.
- **Rationale**: en AdonisJS 7, `request.validateUsing` sin `data` valida `{ ...request.all(), params, headers, cookies }` (`@adonisjs/core/build/main-*.js`), y `request.all()` **mezcla cuerpo y query**. Sin separar, `PUT …/due-date?dueDate=2026-10-01` con cuerpo vacío fijaría la fecha desde la URL, y un `today` en el cuerpo cambiaría el día de referencia. Pasando `data` explícito cada campo solo se lee de donde dice el contrato.
- **Alternatives considered**: un único validador con `dueDate` y `today` sobre `request.all()` — el problema de arriba.

## 5. Formato y rango: `calendarDay()`

- **Decision**: un builder compartido en `app/validators/task.ts` (mismo patrón que `email()`/`password()` en `user.ts`, que no se toca):

  ```ts
  vine.date({ formats: ['YYYY-MM-DD'] })
    .afterOrEqual('1000-01-01')
    .transform((value) => /* Date → luxon DateTime; null → null */)
  ```

  - **Formato único `YYYY-MM-DD`**, pasado explícito: el default de VineJS es `['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss']` (`DEFAULT_DATE_FORMATS`), que aceptaría una fecha con hora.
  - **Parseo estricto**: VineJS llama a `dayjs(value, formats, true)`; en modo estricto dayjs reformatea y compara con la entrada, así que `2026-02-31`, `2025-02-29`, `2026-04-31`, `2026-9-30`, `30/09/2026`, `2026-09-30T00:00:00Z` y `mañana` fallan con la regla `date`. Un número tampoco pasa.
  - **Rango admitido: `1000-01-01` a `9999-12-31`** (el límite que la spec deja al plan). El superior lo impone el propio formato (año de cuatro cifras: `10000-01-01` falla con `date`); el inferior, `afterOrEqual('1000-01-01')` (regla `date.afterOrEqual`). Cualquier otro día que exista, pasado o futuro, se acepta (FR-007, CA-13).
  - **`transform` a Luxon**: VineJS entrega un `Date` de JS; el builder lo convierte en `DateTime` para que controlador y modelo solo vean Luxon. **Ojo**: el compilador de VineJS llama al `transform` también con `null` cuando el campo es `.nullable()` (`@vinejs/compiler/build/index.js`, `defineFieldNullOutput`), así que la función DEBE devolver `null` para `null`. Con `.optional()` y el campo ausente no se llama.
  - **Clave obligatoria en el cuerpo**: `dueDate` debe viajar siempre, con fecha o `null`; sin la clave → `422` con regla `required`. Quitar la fecha es un acto explícito (`null`), no la ausencia de un campo.
  - **`""` en el cuerpo equivale a `null`**: `config/bodyparser.ts` tiene `convertEmptyStringsToNull: true` para JSON, así que el validador recibe `null` y la fecha se quita. Es configuración global que este cambio no toca (alteraría todos los endpoints); se documenta en el contrato y se aserta.
- **Rationale**: el rango inferior tiene tres motivos. (a) Evita guardar años «a medio escribir»: el `input type="date"` nativo emite `0002-…`, `0020-…`, `0202-…` mientras se teclea el año (§11). (b) Mantiene el ancho fijo que hace válida la comparación de §2. (c) dayjs no puede representar los años 0000–0099 (`new Date(50, …)` es 1950) y los rechazaría por un motivo opaco; con el límite, el motivo es explícito y asertable.
- **Alternatives considered**:
  - `vine.string().regex(/^\d{4}-\d{2}-\d{2}$/)` + regla propia de «día existente» — reimplementa lo que el parseo estricto ya hace.
  - Sin límite inferior — años de tres cifras válidos a medias y un comportamiento accidental en 0000–0099.
  - Límite en 1900 o en «hace N años» — arbitrario; la spec admite fechas «hace años» y el único motivo técnico es el ancho fijo.

## 6. Endpoint de escritura: `PUT /api/v1/tasks/:id/due-date` en controlador propio

- **Decision**: `router.put(':id/due-date', [controllers.TaskDueDates, 'update'])` **dentro** del grupo `tasks` de `start/routes.ts` (hereda `middleware.auth()`); nombre de ruta `tasks.due_date.update` o el que genere AdonisJS a partir del controlador (se documenta el real al regenerar `.adonisjs/`). Controlador nuevo `app/controllers/task_due_dates_controller.ts`, acción `update`. Orden: `401` (middleware) → `422` del cuerpo → `422` de `today` → `404` (`Task.findOrFail`) → guardar (`task.merge({ dueDate }).save()`) → `load('assignee')` → `200` con `TaskDetailTransformer`.
- **Rationale**: la fecha es un sub-recurso de la tarea, igual que el estado (`PATCH :id/status` → `TaskStatusesController`). `PUT` porque el cuerpo **reemplaza** el valor entero del sub-recurso (fecha o `null`), idempotente: enviar la misma fecha dos veces deja lo mismo (edge case «poner la misma fecha»; Lucid no emite `UPDATE` si no hay atributos sucios, así que `updated_at` ni se mueve). Validar antes de buscar la fila: mismo orden que `TaskStatusesController`, y garantiza que una fecha inválida nunca llega a tocar la tarea (FR-008). El `404` reutiliza la rama `E_ROW_NOT_FOUND` de `app/exceptions/handler.ts` (sin cambios). Responder con el **detalle** (no con la fila) porque quien llama es la vista de la tarea, que necesita `dueDate` e `isOverdue` para reflejar el cambio al instante (FR-006, CA-3, CA-10).
- **Alternatives considered**:
  - `PATCH /api/v1/tasks/:id` con `{ dueDate }` — abre un endpoint genérico de edición que E2-6 (título) y E2-7 (responsable) todavía no han decidido.
  - `DELETE …/due-date` para quitar — dos verbos para un mismo gesto de la vista; `null` en el `PUT` es un único contrato.
  - Ampliar `TaskStatusesController` — mezcla dos sub-recursos.

## 7. El detalle gana `dueDate` e `isOverdue`; la lista no

- **Decision**: `TaskDetailTransformer` recibe el día de referencia por constructor (`constructor(resource: Task, protected today: DateTime)`; `BaseTransformer.transform(data, ...rest)` pasa `rest` al constructor, ver `@adonisjs/http-transformers/build/src/base_transformer.d.ts`) y añade a lo que ya devolvía:
  - `dueDate: this.resource.dueDate?.toISODate() ?? null` — **no** `this.pick(…, ['dueDate'])`: un `DateTime` serializado por el transformer sale como instante ISO completo (`2026-09-30T00:00:00.000+00:00`), no como día.
  - `isOverdue: this.resource.isOverdueOn(this.today)`.

  `TasksController.show` pasa a leer `today` (§4) y a llamar `TaskDetailTransformer.transform(task, today ?? DateTime.utc())`. `TaskTransformer` (lista, `POST /tasks`, `PATCH :id/status`) **no cambia**.
- **Rationale**: RF-15/CA-11: el vencimiento se ve al abrir la tarea y no en la lista. E2-5 separó ya los dos transformers exactamente para esto ([specs/003-abrir-tarea/research.md §2](../003-abrir-tarea/research.md#2-transformer-propio-del-detalle)). Añadir dos claves al detalle es un cambio **aditivo**: las cinco claves existentes conservan nombre, tipo y valor, y el único consumidor es el frontend de este repo (ver Complexity Tracking del plan).
- **Alternatives considered**:
  - Variante del transformer (`useVariant`) — mezcla lista y detalle en un fichero, lo que E2-5 descartó.
  - Pasar `today` guardándolo en el modelo (`task.$extras`) — estado de la petición colgado de la entidad.

## 8. El test existente `show_task.spec.ts` cambia, y por qué no es «editar un test para que pase»

- **Decision**: antes de implementar nada, se actualiza `backend/tests/functional/tasks/show_task.spec.ts` en una tarea propia, explícita en `tasks.md`: `expectedBody()` añade `dueDate: null` e `isOverdue: false`, y el test «el detalle coincide con la fila de esa tarea en la lista» pasa a exigir `data` del detalle `deepEqual` a `{ ...filaDeLaLista, dueDate: null, isOverdue: false }`. Ese cambio se ejecuta y **falla en rojo** contra el código actual (el detalle aún no tiene las claves), igual que los tests nuevos. Ningún test se borra ni se debilita: las aserciones siguen siendo sobre la forma completa del cuerpo.
- **Rationale**: esos tests fijan la forma completa del detalle con `assert.deepEqual`, y FS-118 cambia esa forma a propósito. El Principio II prohíbe editar un test *para que pase* (tapar un fallo), y exige que todo cambio de comportamiento entre con un test que falle antes y pase después: actualizar la expectativa **antes** de la implementación es exactamente eso. El test de «coincide con la lista» protegía que lista y detalle no divergieran en los campos comunes; la nueva versión lo sigue protegiendo y además fija que las dos claves nuevas son las **únicas** diferencias (más estricta, no menos).
- **Alternatives considered**:
  - No tocarlo y aceptar el rojo — la suite no puede quedar en rojo (Principio II y `guard-tests.mjs`).
  - Cambiar a `assert.containsSubset` — debilita la aserción (dejaría pasar campos extra en el detalle).
  - Dejar el detalle sin los campos si no hay `today` — dos formas para la misma ruta según la query; peor contrato.

## 9. Tests: dónde, en qué orden y contra qué

- **Decision**: dos ficheros nuevos en `backend/tests/functional/tasks/`, escritos y ejecutados en **rojo** antes de la migración, el modelo, los validadores, el controlador y el transformer:
  - `update_task_due_date.spec.ts` — la matriz del `PUT` ([contracts/task-due-date-api.md](./contracts/task-due-date-api.md#matriz-de-comportamiento-definition-of-done)).
  - `task_overdue.spec.ts` — la regla por sus bordes vía `GET /api/v1/tasks/:id` con `today` explícito, el fallback sin `today`, las interacciones con `PATCH :id/status` y creación, y que `GET /api/v1/tasks` no lleva ni `dueDate` ni `isOverdue` ([contracts/task-detail-api.md](./contracts/task-detail-api.md#matriz-de-comportamiento-definition-of-done)).

  Aislamiento con `group.each.setup(() => testUtils.db().truncate())`, como los existentes. Aserción con `assert.deepEqual` sobre `response.body()` entero; `createdAt` esperado sacado de `GET /api/v1/tasks` (patrón de `show_task.spec.ts`). Las fechas de preparación se fijan con `today` explícito (p. ej. `today=2026-09-30`), **nunca** con el reloj, salvo los dos tests del fallback, que usan `DateTime.utc()` ± 2 días para no depender de la hora a la que corra la suite. Los mensajes de error de VineJS se asertan literales (`"The dueDate field must be a datetime value"`, etc.), tal como salen de su diccionario por defecto.
- **Rationale**: Principio II (matriz completa y test en rojo primero). Fijar `today` en la query hace deterministas los bordes (día anterior / mismo día / día posterior) y la prueba de dos husos, que con el reloj real serían inestables alrededor de la medianoche.
- **Alternatives considered**: tests unitarios de `isOverdueOn` en `tests/unit/` — la suite `unit` no tiene aún ningún fichero y la regla ya queda cubierta por sus bordes a través del endpoint, que es la spec ejecutable que pide la constitución. Queda como mejora posible, no como requisito.

## 10. Frontend: tipos y `lib/api.ts`

- **Decision**:
  - `lib/types.ts`: tipo nuevo `TaskDetail = Task & { dueDate: string | null; isOverdue: boolean }`, espejo de `TaskDetailTransformer`. `Task` (lista) **no** cambia.
  - `lib/api.ts`: `RequestOptions.method` admite `'PUT'`; helper interno `localToday()` (fecha local `AAAA-MM-DD`, §3); `getTask(id, token): Promise<TaskDetail>` añade `?today=${localToday()}`; función nueva `setDueDate(id: number, dueDate: string | null, token: string): Promise<TaskDetail>` → `PUT /api/v1/tasks/${id}/due-date?today=…` con `{ dueDate }`. Un `404` se traduce igual que en `getTask` (status `404`, mensaje de tarea inexistente). `FIELD_LABELS` gana `dueDate: 'la fecha de vencimiento'` y `translate()` gana las reglas `date` y `date.afterOrEqual` con el mismo mensaje: «Esa fecha no existe o está incompleta. Escribe un día, un mes y un año de cuatro cifras.».
  - `ApiError.fieldErrors.dueDate` es el mensaje que la vista pinta junto al campo.
- **Rationale**: el mecanismo de errores por campo ya existe (`toApiError` → `fieldErrors`) y es el que pide el input; toda llamada nueva vive en `lib/api.ts` (CLAUDE.md). `localToday()` en cada llamada (no una constante de módulo) para que una pestaña abierta varios días pida con el día correcto.
- **Alternatives considered**: ampliar `Task` con campos opcionales — deja que la lista «pueda» llevar la fecha en el tipo, lo contrario de CA-11.

## 11. Frontend: el campo, el guardado automático y los errores

- **Decision** (en `pages/task-page.tsx`; detalle en [contracts/task-due-date-ui.md](./contracts/task-due-date-ui.md)):
  - Una fila nueva «Vence el» en el `<dl>` existente con `<Label>` + `<Input type="date">` (componentes de `ui/`, sin dependencias ni componentes nuevos), un `<Button variant="outline" size="sm">Quitar fecha</Button>` solo cuando hay fecha, y la señal «Vencida» como **texto** (`text-destructive font-medium`) dentro de una región `role="status"`, solo cuando `isOverdue` es `true`.
  - Bajo el campo, en texto, la fecha absoluta en castellano («Vence el 30 de septiembre de 2026»), formateada con `Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' })` sobre `new Date(\`${dueDate}T00:00:00Z\`)`. El `timeZone: 'UTC'` es obligatorio: `new Date('2026-09-30')` es medianoche UTC, que en América ya es el 29.
  - **Campo no controlado** (`defaultValue` + `key` que cambia cuando cambia la fecha guardada o tras un fallo), para no pelear con la edición por segmentos del input nativo; al fallar, la `key` nueva lo devuelve a la fecha guardada.
  - **Guardado al cambiar**, sin botón ni confirmación (CA-15, CA-16): cada `change` programa un guardado con una espera corta (~500 ms) que se adelanta al perder el foco; **solo** se envía un valor completo (`/^\d{4}-\d{2}-\d{2}$/` con año ≥ 1000). No se solapan peticiones: si hay una en curso, se guarda el último valor pendiente cuando termine, y solo se pinta la respuesta de la última.
  - **Qué significa cada valor del input**: fecha completa → guardar; vacío con `validity.badInput` (fecha imposible o a medio escribir) → mensaje local junto al campo, sin petición, la tarea conserva su fecha (FR-008, edge case 1); vacío sin `badInput` (el usuario borró todos los segmentos) → no se guarda nada y, al perder el foco, el campo vuelve a la fecha guardada; quitar es **solo** el botón (1 interacción, SC-001).
  - **Errores**: `422` → `fieldErrors.dueDate` junto al campo, campo devuelto a la fecha guardada; sin conexión o `5xx` → «No se ha podido guardar la fecha. Comprueba la conexión e inténtalo de nuevo.» junto al campo, y el campo vuelve a la fecha guardada (FR-009); `401` → el mensaje de sesión caducada de `toApiError`, igual que en el resto de pantallas protegidas; `404` → la vista pasa al estado «Esta tarea ya no existe» que ya tiene la página, con «Volver a la lista» (FR-010).
  - **Teclado** (FR-018): input nativo y botón en el orden de tabulación; tras «Quitar fecha» el foco vuelve al campo (el botón desaparece).
- **Rationale**: `input type="date"` da selector y validación de calendario sin dependencias (R-3). El navegador ya impide o marca como `badInput` los días imposibles; el backend repite la validación (§5) porque el cliente no es fiable. La espera corta y la guarda de año ≥ 1000 existen porque el input nativo emite valores completos pero intermedios mientras se teclea (`0002-09-30`, `2026-09-03` antes de `2026-09-30`); sin ellas se guardarían días que nadie quiso (edge case «una fecha a medio escribir no sustituye a la anterior»). No solapar peticiones evita que una respuesta antigua pise a la nueva.
- **Alternatives considered**:
  - Guardar solo al perder el foco — elegir en el selector del calendario no siempre saca el foco; el usuario cerraría sin guardar (CA-16).
  - Campo controlado — React reescribe `value` en cada render y rompe la edición por segmentos del input nativo.
  - Borrar todos los segmentos = quitar la fecha — ambiguo con «a medio escribir» según navegador; el botón es inequívoco y cuesta 1 interacción.
  - Un selector de fecha de terceros — dependencia nueva (R-3).

## 12. Código generado y lo que no se toca

- **Decision**: `node ace migration:run` regenera `backend/database/schema.ts` (no se edita a mano); correr la suite o el dev server regenera `backend/.adonisjs/server/controllers.ts` (entra `TaskDueDates`), `backend/.adonisjs/client/registry/` (ruta `PUT`) y `backend/.adonisjs/client/data.d.ts` (`TaskDetail` con `dueDate`/`isOverdue`). Los tres diffs se commitean. No se toca: `app/exceptions/handler.ts`, `app/transformers/task_transformer.ts`, `app/controllers/task_statuses_controller.ts`, `frontend/src/pages/tasks-page.tsx`, `frontend/src/components/tasks/*`, `package.json` de ninguno de los dos lados, ni nada de la zona vallada de BOUNDARIES.md. CORS ya admite `PUT` (`config/cors.ts`).
- **Rationale**: CLAUDE.md (código generado versionado) y Principio III.
