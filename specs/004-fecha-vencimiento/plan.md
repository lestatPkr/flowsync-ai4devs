# Implementation Plan: Fecha de vencimiento y tareas vencidas

**Branch**: `feat/fs-118-fecha-vencimiento` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-fecha-vencimiento/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Permitir a cualquier miembro con sesión poner, cambiar y quitar la fecha de vencimiento de cualquier tarea desde su vista (E2-5), guardándose sola al cambiar, sin confirmación y rechazando junto al campo las fechas imposibles sin tocar la que hubiera (FR-001 a FR-010, FR-018 a FR-022); y decir en esa vista, con una señal de texto «Vencida», si la tarea está vencida según el día de hoy **de quien mira**, decidido al mirar y no al guardar (FR-011 a FR-016), sin que nada de eso aparezca en la lista ni en la creación (FR-002, FR-017).

Enfoque técnico: **cambio de esquema** con una migración nueva (`add_due_date_to_tasks`) que añade `tasks.due_date` `date` nullable sin default; `database/schema.ts` se regenera con `node ace migration:run`, y `Task` hereda `dueDate` y solo gana el método `isOverdueOn(today)`, **única** implementación de la regla. El día de referencia llega como query opcional `?today=AAAA-MM-DD` (fallback: fecha UTC del servidor) en `GET /api/v1/tasks/:id` y en el endpoint nuevo `PUT /api/v1/tasks/:id/due-date` (`TaskDueDatesController.update`, dentro del grupo `tasks` con `middleware.auth()`), validados con VineJS por separado de cuerpo y query. `TaskDetailTransformer` gana `dueDate` e `isOverdue`; `TaskTransformer` (la lista) no cambia. En el frontend, `task-page.tsx` gana un `input type="date"` nativo con guardado automático, «Quitar fecha» y la señal «Vencida»; `lib/api.ts` gana `setDueDate()` y envía `today` local en `getTask()`; `lib/types.ts` gana `TaskDetail`. Ninguna dependencia nueva; la zona vallada no se toca.

## Technical Context

**Language/Version**: TypeScript 6 (backend y frontend), Node.js (versión ya fijada por el repo; sin cambios)

**Primary Dependencies**: Backend: AdonisJS 7 (`@adonisjs/core` 7.3), Lucid 22.4, VineJS 4.4 (`vine.date` con parseo estricto de dayjs), Auth 10, Luxon (ya instalados). Frontend: React 19, Vite 8, react-router 8.3, shadcn/ui sobre Tailwind v4 (`Input`, `Label`, `Button`, `Card`, `Alert` ya generados), `FieldError` propio (ya existe). Ninguna dependencia nueva (R-3, BOUNDARIES.md).

**Storage**: SQLite vía Lucid. **Migración nueva** sobre la tabla `tasks`: columna `due_date` `date` NULL sin default, con `down()` que la quita ([data-model.md](./data-model.md)). Las tareas existentes quedan con `NULL`.

**Testing**: Backend: Japa, suite `functional`, en `backend/tests/functional/tasks/`: **nuevos** `update_task_due_date.spec.ts` (matriz del `PUT`) y `task_overdue.spec.ts` (regla por sus bordes vía `GET` con `today` explícito, fallback UTC, interacción con estado y creación, lista sin la fecha); **actualización explícita** de `show_task.spec.ts` (las dos claves nuevas del detalle). Todo escrito y ejecutado en **rojo** antes de la implementación, aislado con `testUtils.db().truncate()`. Cobertura con `npm run test:coverage` (c8, suelo 60 %). Frontend: sin runner (fuera de alcance); verificación manual vía [quickstart.md](./quickstart.md).

**Target Platform**: Aplicación web (backend HTTP en `localhost:3333`, SPA en `localhost:5173`; CORS ya admite `PUT`). Navegadores con `input type="date"` nativo (Chrome, Edge, Firefox, Safari ≥ 14.1).

**Project Type**: Web application (backend + frontend, monorepo sin workspaces).

**Performance Goals**: El cambio de fecha y de condición de vencida se ven en <1 s a la escala de RNF-5 (SC-002): una escritura por id y la respuesta ya trae la tarea recalculada, sin segunda lectura.

**Constraints**: Sin dependencias nuevas; `database/schema.ts` solo por regeneración; rutas existentes sin cambio de path ni verbo, y sin quitar ni cambiar claves de sus respuestas (el detalle solo **añade** dos); `TaskTransformer` intacto; la regla en un único sitio (`Task.isOverdueOn`); `today` opcional; zona vallada intacta; estilo visual con los componentes de `ui/`; señal de vencida legible sin color; todo con teclado.

**Scale/Scope**: Espacio único compartido, equipo de 3-10 personas. Sin lista viva (E3); último cambio gana (PA-8).

Ningún punto queda en NEEDS CLARIFICATION: lo que la spec delegaba al plan (límites del rango de fechas, formato de la fecha, textos de la señal y de los mensajes, cómo se reconcilia guardar solo con no tragarse fechas a medio escribir) se resuelve en [research.md](./research.md) (§5, §10, §11).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` **v1.1.0**.

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` no nombra columnas, rutas, códigos, transformers ni `today`: habla de «día de referencia de quien mira», «señal propia» y «mensaje junto al campo». `due_date`, `PUT …/due-date`, `?today=`, `isOverdueOn`, el `422` y el `input type="date"` aparecen solo aquí y en los artefactos de diseño. |
| II. Los tests son la spec ejecutable (**matriz = DoD**) | ✅ Los dos endpoints tienen su **matriz completa**, asertada contra la forma entera del cuerpo (`assert.deepEqual` sobre `response.body()`), escrita y ejecutada en **rojo** antes de la migración, el modelo, los validadores, el controlador y el transformer. **`PUT …/due-date`** ([contrato](./contracts/task-due-date-api.md#matriz-de-comportamiento-definition-of-done)): camino feliz (poner, cambiar, quitar, fecha pasada aceptada, quitar/aplazar deja de vencer en la misma respuesta, tarea ajena, solo escribe la fecha, misma fecha sin escritura, extremos del rango, `""` = quitar, fallback UTC); `422` (día inexistente conservando la fecha anterior, mal formada, con hora, falta la clave, fuera de rango, `today` inválido, la fecha no sale de la query, `422` antes que `404`); `401` (sin sesión y token inválido, BD intacta); `404` (inexistente, borrada, no numérico). **`GET /tasks/:id` con `today`** ([contrato](./contracts/task-detail-api.md#matriz-de-comportamiento-definition-of-done)): los cuatro bordes (día anterior → vencida, mismo día → no, posterior → no, sin fecha → no), `in_progress`, hecha con fecha pasada → no, dos `today` sobre la misma tarea → dos lecturas correctas, paso de la medianoche sin escribir, retirar la fecha, pasar a «Hecho» conserva la fecha y deja de vencer, salir de «Hecho» vuelve a vencer, crear no pone fecha, fallback UTC, `422` de `today`; `401`/`404` siguen cubiertos por `show_task.spec.ts`. **La lista**: un test comprueba que `GET /tasks` no lleva `dueDate` ni `isOverdue` y que poner una fecha no cambia la fila. **Test existente que cambia**: `show_task.spec.ts` fija la forma completa del detalle, que este cambio amplía a propósito; se actualiza **antes** de implementar, en tarea propia, y falla en rojo contra el código actual — es el «test que falla antes y pasa después» que exige el principio, no un test editado para que pase; ninguna aserción se debilita ([research.md §8](./research.md#8-el-test-existente-show_taskspects-cambia-y-por-qué-no-es-editar-un-test-para-que-pase)). `create_task`, `list_tasks` y `update_task_status` siguen en verde **sin editarse**. La cobertura de `backend/app/` no baja: el controlador, los validadores, el método de la regla y el transformer quedan ejercitados por las matrices. |
| III. La valla manda | ✅ Ningún fichero de BOUNDARIES.md se toca (ni controladores/middlewares/validador/modelo de auth, ni migraciones de `users`/`access_tokens`, ni `frontend/src/auth/`). `database/schema.ts` cambia **solo** por `node ace migration:run`, nunca a mano. La ruta nueva va **dentro** del grupo `tasks` con `middleware.auth()`. Las rutas existentes no cambian de path ni verbo; `GET`/`POST /tasks` y `PATCH :id/status` no cambian ni la forma (TaskTransformer intacto). `GET /tasks/:id` **añade** una query opcional y dos claves: ver Complexity Tracking. Sin dependencias (Luxon ya estaba). Sin secretos. |
| IV. Convenciones del repo | ✅ **Migración para el cambio de esquema** (`node ace make:migration add_due_date_to_tasks`, con `down()` reversible). Comandos desde `backend/`/`frontend/`; controlador vía `#generated/controllers`; respuesta por `serialize()` + transformer de `app/transformers/`; validadores VineJS con `vine.create` y builder de campo compartido (`calendarDay()`); imports por subpath; la llamada nueva solo en `lib/api.ts`, con el mensaje en castellano generado allí y el mecanismo de `fieldErrors` existente; la vista con `Input`/`Label`/`Button` de `ui/` y `FieldError`, sin rediseño; Prettier por el hook. `.adonisjs/` y `database/schema.ts` regenerados y commiteados. |
| V. Cambios pequeños, revisables y con su spec | ✅ Una historia (FS-118), un PR: 1 migración, 1 método de dominio, 2 validadores + 1 builder, 1 controlador nuevo + 1 acción ampliada, 1 transformer ampliado, 1 ruta, 2 ficheros de tests nuevos + 1 actualizado, 1 tipo, 1 función de API y 1 fila en la vista. Vive en `specs/004-fecha-vencimiento/` con spec + plan + tasks. |

**Resultado (pre-Phase 0)**: PASS, con una decisión que justificar en Complexity Tracking (forma ampliada de `GET /tasks/:id`).

**Re-check post-Phase 1**: PASS. El diseño precisa tres puntos que no estaban en el input, todos dentro de la valla y sin cambio para lo existente:

1. **Rango `1000-01-01`–`9999-12-31`** para `dueDate` y `today` ([research.md §5](./research.md#5-formato-y-rango-calendarday)): la spec lo delegaba al plan; el inferior evita guardar años a medio teclear y mantiene válida la comparación por día.
2. **Cuerpo y query validados por separado** (`{ data: request.body() }` / `{ data: request.qs() }`, [§4](./research.md#4-validar-la-query-por-separado-del-cuerpo)): `request.all()` los mezcla y permitiría fijar la fecha desde la URL.
3. **`""` en el cuerpo quita la fecha** por `convertEmptyStringsToNull` del bodyparser global, que no se toca; se documenta y se aserta ([contrato](./contracts/task-due-date-api.md#respuesta--éxito-200)).

## Project Structure

### Documentation (this feature)

```text
specs/004-fecha-vencimiento/
├── spec.md              # /speckit-specify
├── checklists/          # /speckit-specify
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── task-due-date-api.md     # PUT /api/v1/tasks/:id/due-date (nuevo) + matriz
│   ├── task-detail-api.md       # GET /api/v1/tasks/:id con today (aditivo) + matriz; la lista sin cambios
│   └── task-due-date-ui.md      # la fila «Vence el» de la vista, api.ts y types.ts
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── database/
│   ├── migrations/
│   │   └── <ts>_add_due_date_to_tasks.ts    # nuevo: alterTable tasks + date('due_date').nullable(); down: dropColumn
│   └── schema.ts                            # REGENERADO por migration:run (TaskSchema + dueDate); nunca a mano
├── app/
│   ├── models/task.ts                       # + isOverdueOn(today: DateTime): boolean (la regla, único sitio)
│   ├── validators/task.ts                   # + calendarDay() builder, updateTaskDueDateValidator, taskReadingDayValidator
│   ├── controllers/
│   │   ├── task_due_dates_controller.ts     # nuevo: update (validar cuerpo → today → findOrFail → merge/save → detalle)
│   │   ├── tasks_controller.ts              # show: lee today (qs) y lo pasa al transformer
│   │   └── task_statuses_controller.ts      # sin cambios
│   ├── transformers/
│   │   ├── task_detail_transformer.ts       # + constructor(resource, today); + dueDate (toISODate|null), + isOverdue
│   │   └── task_transformer.ts              # sin cambios (la lista no lleva la fecha)
│   └── exceptions/handler.ts                # sin cambios (E_ROW_NOT_FOUND → 404 ya existe)
├── start/routes.ts                          # + router.put(':id/due-date', [controllers.TaskDueDates, 'update']) en el grupo tasks
├── .adonisjs/                               # REGENERADO: server/controllers.ts, client/registry/, client/data.d.ts
└── tests/functional/tasks/
    ├── update_task_due_date.spec.ts         # nuevo, ANTES que la implementación
    ├── task_overdue.spec.ts                 # nuevo, ANTES que la implementación
    └── show_task.spec.ts                    # actualizado ANTES: expectedBody + dueDate/isOverdue

frontend/src/
├── lib/
│   ├── api.ts                               # + 'PUT', localToday(), getTask → TaskDetail con ?today, setDueDate(), traducción de date
│   └── types.ts                             # + TaskDetail (Task sin cambios)
└── pages/
    └── task-page.tsx                        # + fila «Vence el»: input date, «Quitar fecha», «Vencida», error junto al campo
```

**Structure Decision**: Layout web existente, `backend/` (AdonisJS, API) + `frontend/` (React SPA), sin carpetas nuevas. La fecha es un sub-recurso de la tarea, como el estado, y sigue el mismo patrón (`TaskStatusesController` → `TaskDueDatesController`, [research.md §6](./research.md#6-endpoint-de-escritura-put-apiv1tasksiddue-date-en-controlador-propio)). La regla va en el modelo porque es de dominio; el transformer y el frontend solo la consumen. La lista (`tasks-page.tsx`, `components/tasks/`) no se toca.

## Complexity Tracking

| Decisión que roza la valla | Por qué hace falta | Alternativa más simple, descartada porque |
|---|---|---|
| `GET /api/v1/tasks/:id` **añade** dos claves (`dueDate`, `isOverdue`) a su respuesta y acepta una query opcional `today`. BOUNDARIES.md prohíbe cambiar «la forma de la respuesta» de una ruta existente. | RF-15 exige que el vencimiento se vea **al abrir la tarea**, y esa vista se alimenta de esta ruta. El cambio es estrictamente **aditivo**: path, verbo, las cinco claves existentes (nombre, tipo y valor), `401` y `404` quedan igual, y una petición sin `today` sigue funcionando; ningún cliente que lea las claves de antes se rompe. El único consumidor es el frontend de este repo, que se actualiza en el mismo PR. E2-5 separó `TaskDetailTransformer` precisamente para esto ([specs/003-abrir-tarea/research.md §2](../003-abrir-tarea/research.md#2-transformer-propio-del-detalle)), y el input de este plan lo declara aditivo. El único cambio observable para una petición antigua con una query `today` basura es un `422` donde antes se ignoraba; `today` no existía, así que ningún cliente la manda. | (a) Una ruta nueva `GET /tasks/:id/due-date` — la vista tendría que hacer dos peticiones y combinar dos respuestas para una sola tarea, y la señal «Vencida» podría pintarse con un estado distinto del de la otra respuesta. (b) Calcular `isOverdue` en el frontend a partir de la fecha — la regla saldría del dominio (el input lo prohíbe) y seguiría necesitando añadir `dueDate` al detalle. |
| `show_task.spec.ts` (test existente) cambia su `expectedBody()` y el test «coincide con la lista». La constitución prohíbe editar un test *para que pase*. | Esos tests fijan la forma completa del detalle, que cambia a propósito (fila anterior). La actualización se hace **antes** de implementar, falla en rojo y pasa en verde con la implementación: es el test de cambio de comportamiento que el Principio II exige. Las aserciones siguen siendo de forma completa; la de «coincide con la lista» se vuelve más estricta (fija que las dos claves nuevas son las únicas diferencias). | No tocarlo (suite en rojo, bloqueada por `guard-tests.mjs`) o relajarlo a `containsSubset` (debilitaría la aserción). |
