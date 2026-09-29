# Implementation Plan: Filtrar la lista por estado

**Branch**: `feat/fs-142-filtrar-por-estado` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-filtrar-por-estado/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Que la lista del espacio compartido muestre por defecto lo vivo —pendientes y en curso— y deje lo hecho fuera pero consultable (RF-21), y que cualquiera pueda acotarla a **un** estado (RF-20), tanto desde una petición como desde la interfaz; que un filtro que no es ninguno de los tres estados se **rechace** en vez de devolver una lista vacía (CA-9, CA-10), que un filtro válido sin resultados sea una lista vacía y no un error (CA-7), y que la interfaz distinga los vacíos entre sí (CA-8), no recuerde el filtro entre visitas (CA-17) y saque de la vista lo que deja de encajar al cambiar de estado (CA-5).

Enfoque técnico: **sin cambio de esquema ni rutas nuevas**. `GET /api/v1/tasks` gana una query opcional `status` validada con VineJS (`listTasksValidator`: `vine.enum(TASK_STATUSES).optional()` sobre `request.qs()`), consumida en `TasksController.index`: sin `status` → `whereIn('status', LIVE_TASK_STATUSES)` (constante nueva del modelo, `pending` + `in_progress`); con `status` → `where('status', status)`; cualquier otro valor —vacío, desconocido, otra caja, repetido— → `422` con el formato VineJS de siempre (`field: 'status'`, `meta.choices`). Mismo orden y mismo `TaskTransformer`. Tests Japa en un fichero nuevo `list_tasks_by_status.spec.ts`, uno por escenario de la spec, en **rojo** antes de implementar. En el frontend, `listTasks(token, status?)` pasa el parámetro y `spaceHasTasks()` distingue el espacio vacío con una lectura complementaria solo cuando la lista llega vacía; el filtro vive en memoria de un **layout de ruta** sobre `/tasks` y `/tasks/:id` (para sobrevivir a abrir y cerrar una tarea, no a recargar); un grupo de `Button` con `aria-pressed` («Pendiente · En curso · Hecho» y «Quitar filtro») y cinco estados de la lista mutuamente excluyentes. Ninguna dependencia nueva; la zona vallada no se toca.

## Technical Context

**Language/Version**: TypeScript 6 (backend y frontend), Node.js (versión ya fijada por el repo; sin cambios)

**Primary Dependencies**: Backend: AdonisJS 7 (`@adonisjs/core` 7.3), Lucid 22.4, VineJS 4.4 (`vine.enum`, `.optional()`; comportamiento con `''`, arrays y caja **probado** contra la versión instalada, [research §2](./research.md#2-validación-vineenumtask_statusesoptional-sobre-requestqs)), Auth 10 (ya instalados). Frontend: React 19, Vite 8, react-router 8.3 (`Outlet` + `useOutletContext`), shadcn/ui sobre Tailwind v4 (`Button`, `Card`, `Alert` ya generados). Ninguna dependencia nueva (R-3, BOUNDARIES.md).

**Storage**: SQLite vía Lucid. **Sin migración ni cambio de esquema**: se filtra por `tasks.status`, que ya existe ([data-model.md](./data-model.md)). `database/schema.ts` no cambia.

**Testing**: Backend: Japa, suite `functional`, en `backend/tests/functional/tasks/`: **nuevo** `list_tasks_by_status.spec.ts` con la matriz completa de `GET /tasks?status=` (15 escenarios, [contrato](./contracts/task-list-api.md#matriz-de-comportamiento-definition-of-done)), escrito y ejecutado en **rojo** antes del validador y del controlador, aislado con `testUtils.db().truncate()`. **Helpers** (no aserciones) de `show_task.spec.ts`, `update_task_status.spec.ts` y `task_overdue.spec.ts` actualizados antes, verde→verde ([research §6](./research.md#6-tests-existentes-que-leen-createdat-de-la-lista-sin-filtro)). `list_tasks.spec.ts` y `update_task_due_date.spec.ts` sin editar. Cobertura con `npm run test:coverage` (c8, suelo 60 %). Frontend: sin runner (fuera de alcance); `npm run lint` + `npm run build` y verificación manual vía [quickstart.md](./quickstart.md).

**Target Platform**: Aplicación web (backend HTTP en `localhost:3333`, SPA en `localhost:5173`). CORS sin cambios (`GET` ya admitido; no se exponen cabeceras nuevas).

**Project Type**: Web application (backend + frontend, monorepo sin workspaces).

**Performance Goals**: Aplicar o quitar un filtro se ve en <1 s a la escala de RNF-5 (SC-011): una lectura filtrada en SQL (no en memoria), y como mucho dos lecturas complementarias solo cuando la lista llega vacía ([research §5](./research.md#5-saber-si-el-espacio-está-vacío-fr-008-us1-11-sin-cambiar-la-forma-de-la-respuesta)). Los cambios de estado y la creación corrigen la vista en local, sin volver a pedirla ([research §9](./research.md#9-mantener-la-vista-cierta-tras-los-cambios-locales-fr-016-fr-020-sc-009)).

**Constraints**: Sin dependencias nuevas; sin tocar el esquema; `GET /api/v1/tasks` sin cambio de path, verbo ni forma de respuesta (`{ data: Task[] }`, `TaskTransformer` intacto, mismo orden); un solo estado por petición; `422` con el formato VineJS existente, nunca `200 []` para un filtro no válido; filtro de la interfaz solo en memoria (ni URL, ni `history.state`, ni `localStorage`/`sessionStorage`); zona vallada intacta; estilo visual con los componentes de `ui/`; filtro operable por teclado e identificable sin color.

**Scale/Scope**: Espacio único compartido, equipo de 3-10 personas. Sin lista viva (E3-2): los cambios ajenos se ven al volver a cargar. Sin paginación ni orden propio para «Hecho» (PA-3).

Ningún punto queda en NEEDS CLARIFICATION: lo que la spec delegaba al plan —cómo se nombran los estados en la petición y si se distinguen mayúsculas, la forma del control, los textos de los vacíos y del filtro no válido, y el reparto en commits/PR— se resuelve en [research.md](./research.md) (§1, §8, §10, §12).

### Dónde el plan se aparta del input, y por qué

1. **El filtro vive en un layout de ruta, no en `tasks-page.tsx`.** `TaskPage` es otra ruta; con el estado en `TasksPage` el filtro se perdería al abrir y cerrar una tarea (FR-013, US2-13). Sigue siendo memoria de componente, sin URL ni almacenamiento, y se pierde al recargar, al cerrar sesión y al salir a otra pantalla (CA-17) — [research §7](./research.md#7-dónde-vive-el-filtro-un-layout-de-ruta-sobre-tasks-y-tasksid).
2. **Los vacíos son los de la spec, no los tres del input.** El input pedía `EmptyTasksState` «solo cuando no hay filtro y la lista sin filtro está vacía», que mostraría «crea la primera» en un espacio con todo hecho (FR-017 c, US2-10) y «no hay tareas en este estado» en un espacio vacío con filtro (FR-017 b, US2-9). El plan añade el vacío (c) «nada pendiente ni en curso», el fallo de carga (FR-019; hoy la página lo pinta como espacio vacío) y la lectura complementaria que distingue (b) de (a)/(c) sin tocar la respuesta — [research §5, §10, §11](./research.md#5-saber-si-el-espacio-está-vacío-fr-008-us1-11-sin-cambiar-la-forma-de-la-respuesta).
3. **La matriz tiene los escenarios que el input no listaba**: US1-8 (varios estados / «todas»), US1-9 (la tarea cambia de vista al cambiar de estado), US1-11 (espacio vacío distinguible), el `422` en un espacio vacío, FR-011 (otros parámetros no filtran) y el orden.
4. **Tres ficheros de tests existentes cambian su helper** (no sus aserciones), porque leían `createdAt` de tareas hechas en la lista sin filtro — [Complexity Tracking](#complexity-tracking).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` **v1.1.0**.

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` habla de «pedir la lista de un estado», «rechazo», «aviso de filtro no válido» y «vista por defecto»; no nombra `?status=`, `422`, `vine.enum`, `whereIn`, `TasksLayout` ni `aria-pressed`. Todo eso aparece solo aquí y en los artefactos de diseño. Lo que la spec delegaba (nombres de los estados en la petición, textos, forma del control, reparto en PR) se decide aquí, no se reinventa en la spec. |
| II. Los tests son la spec ejecutable (**matriz = DoD**) | ✅ `GET /api/v1/tasks` con `status` tiene su **matriz completa** ([contrato](./contracts/task-list-api.md#matriz-de-comportamiento-definition-of-done)), un test por escenario de la US1 (P1) y titulado como él, asertada contra la **forma entera** del cuerpo (`assert.deepEqual` sobre `response.body()`, todas las filas, todas las claves, en orden) y escrita y ejecutada en **rojo** antes del validador y del controlador: camino feliz (vista por defecto, cada uno de los tres estados, válido sin resultados → `200 []`, transición entre vistas, orden, otros parámetros no filtran, espacio vacío distinguible, ninguna tarea modificada con `updated_at` retrasado); `422` (desconocido, vacío, otra caja, etiqueta en castellano, repetido, «todas», y en un espacio vacío), con `field: 'status'` y `meta.choices`; `401` (sin token y token inválido, con y sin filtro, antes que el `422`); `404` no aplica (colección). Es un cambio de comportamiento (la lista sin filtro deja de traer las hechas) y entra con tests que fallan antes y pasan después. **Tests existentes**: ninguno se edita para que pase; tres helpers cambian antes, verde→verde, sin tocar aserciones (Complexity Tracking). La cobertura de `backend/app/` no baja: la acción `index`, el validador y la constante quedan ejercitados. |
| III. La valla manda | ✅ Ningún fichero de BOUNDARIES.md se toca (ni controladores/middlewares/validador/modelo de auth, ni migraciones de `users`/`access_tokens`, ni `frontend/src/auth/`; `routes/` y `app-routes.tsx` no son zona vallada). `database/schema.ts` no cambia. **No se añade ninguna ruta** y la existente no cambia de path, verbo ni forma de respuesta: añadir una query opcional es aditivo (así lo declara el input). El cambio de **contenido** sin query (las hechas dejan de venir) es el comportamiento que la spec pide explícitamente (RF-21, FR-001) y sustituye `specs/002` FR-013; ver Complexity Tracking. Sin dependencias nuevas (ni `ToggleGroup` de shadcn). Sin secretos. |
| IV. Convenciones del repo | ✅ Comandos desde `backend/`/`frontend/`; validador VineJS con `vine.create` en `app/validators/task.ts`, reutilizando `TASK_STATUSES`; `request.validateUsing(…, { data: request.qs() })` como en `show`; respuesta por `serialize()` + `TaskTransformer`; imports por subpath; la llamada a la API solo en `lib/api.ts`, con el mensaje en castellano que ya produce su `translate`; la interfaz con `Button`/`Card`/`Alert` de `ui/` y el patrón de `EmptyTasksState` y de las alertas de `TaskPage`, sin rediseño (R-8); Prettier por el hook; oxlint. Sin cambio de esquema, así que ninguna migración. `.adonisjs/client/registry/` se regenera (la ruta gana `query`) y se commitea. |
| V. Cambios pequeños, revisables y con su spec | ✅ Una historia (FS-142), un PR: 1 validador, 1 constante, 1 acción ampliada, 1 fichero de tests nuevo + 3 helpers, 1 función de API ampliada + 1 nueva, 1 layout + 1 hook, 1 componente, 1 página. Vive en `specs/005-filtrar-por-estado/` con spec + plan + tasks. La US1 queda completa y en verde antes de empezar la US2 ([research §12](./research.md#12-reparto-en-commits-y-pr)). |

**Resultado (pre-Phase 0)**: PASS, con dos decisiones que justificar en Complexity Tracking (el contenido de la lista sin filtro cambia; tres helpers de tests existentes cambian).

**Re-check post-Phase 1**: PASS. El diseño precisa cuatro puntos que no estaban en el input, todos dentro de la valla y sin cambio de forma para lo existente:

1. **`?status=` vacío se rechaza** porque `convertEmptyStringsToNull` solo actúa sobre cuerpos, no sobre la query; y `?status=a&status=b` llega como array y el `enum` lo rechaza. Ambos probados y asertados ([research §2](./research.md#2-validación-vineenumtask_statusesoptional-sobre-requestqs)).
2. **Otros parámetros de la query se ignoran**, como en el resto de la API; un test fija que no filtran (FR-011, [§4](./research.md#4-cualquier-otro-parámetro-se-ignora-fr-011)).
3. **El espacio vacío se distingue por partición** (vista por defecto ⊔ «Hecho») con una lectura complementaria solo en el caso vacío, sin cabeceras ni claves nuevas ([§5](./research.md#5-saber-si-el-espacio-está-vacío-fr-008-us1-11-sin-cambiar-la-forma-de-la-respuesta)).
4. **El filtro en un layout de ruta** y la corrección local de la vista con inserción ordenada y gestión del foco ([§7](./research.md#7-dónde-vive-el-filtro-un-layout-de-ruta-sobre-tasks-y-tasksid), [§9](./research.md#9-mantener-la-vista-cierta-tras-los-cambios-locales-fr-016-fr-020-sc-009)).

## Project Structure

### Documentation (this feature)

```text
specs/005-filtrar-por-estado/
├── spec.md              # /speckit-specify
├── checklists/          # /speckit-specify
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command) — nada cambia en el esquema
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── task-list-api.md     # GET /api/v1/tasks con status (aditivo) + matriz
│   └── task-list-ui.md      # api.ts, layout del filtro, control, estados de la lista
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── models/task.ts                       # + LIVE_TASK_STATUSES = ['pending', 'in_progress'] (la vista por defecto)
│   ├── validators/task.ts                   # + listTasksValidator: { status: vine.enum(TASK_STATUSES).optional() }
│   ├── controllers/tasks_controller.ts      # index: valida qs → where(status) | whereIn(LIVE_TASK_STATUSES); mismo orden y transformer
│   └── transformers/task_transformer.ts     # sin cambios
├── start/routes.ts                          # sin cambios
├── database/schema.ts                       # sin cambios
├── .adonisjs/client/registry/               # REGENERADO: tasks.tasks.index gana query (commitear)
└── tests/functional/tasks/
    ├── list_tasks_by_status.spec.ts         # nuevo, ANTES que la implementación (matriz de 15 escenarios)
    ├── show_task.spec.ts                    # solo el helper fetchListed: busca en las dos vistas
    ├── update_task_status.spec.ts           # solo el helper fetchCreatedAt: busca en las dos vistas
    ├── task_overdue.spec.ts                 # solo el helper fetchListed: busca en las dos vistas
    ├── list_tasks.spec.ts                   # sin cambios
    └── update_task_due_date.spec.ts         # sin cambios

frontend/src/
├── lib/api.ts                               # listTasks(token, status?) + spaceHasTasks(token, emptyView)
├── routes/
│   ├── app-routes.tsx                       # /tasks y /tasks/:id dentro de <TasksLayout>
│   └── tasks-layout.tsx                     # nuevo: useState del filtro + <Outlet context> + useTaskFilter()
├── components/tasks/
│   └── task-status-filter.tsx               # nuevo: grupo de Button con aria-pressed + «Quitar filtro» + línea de estado
└── pages/tasks-page.tsx                     # carga por filtro (ignore de obsoletas), 5 estados de la lista, cambios locales, foco
```

**Structure Decision**: Layout web existente, `backend/` (AdonisJS, API) + `frontend/` (React SPA), sin carpetas nuevas. El filtro es una lectura de la colección existente, no un recurso: va como query de `GET /tasks` en la acción `index` que ya existe, sin controlador nuevo. La definición de la vista por defecto va en el modelo, junto al catálogo de estados. En el frontend, el estado del filtro sube a un layout de ruta en `routes/` (junto a los guards) porque tiene que abarcar dos pantallas; el control es un componente de `components/tasks/` como `TaskStatusSelect`. `TaskList`, `TaskStatusSelect`, `EmptyTasksState`, `TaskForm` y `TaskPage` no cambian.

## Complexity Tracking

| Decisión que roza la valla o la constitución | Por qué hace falta | Alternativa más simple, descartada porque |
|---|---|---|
| `GET /api/v1/tasks` **sin** query deja de devolver las tareas `done`. BOUNDARIES.md prohíbe cambiar una ruta pública existente (path, verbo o forma de la respuesta). | Es el requisito central de la spec (RF-21, FR-001, CA-1): la vista por defecto excluye lo hecho, y la spec sustituye explícitamente `specs/002-cambiar-estado/` FR-013 y el supuesto de `specs/004-fecha-vencimiento/`, escritos «a la espera de FS-142». Path, verbo y **forma** (`{ data: Task[] }`, claves de cada fila, orden) no cambian; lo que cambia es **qué filas** entran, que es comportamiento de producto. Lo hecho sigue siendo consultable con `?status=done`. El único consumidor es el frontend de este repo, que se actualiza en el mismo PR. | (a) Mantener todas sin query y filtrar en el frontend — incumple FR-001/FR-003 para cualquier petición de fuera y trae lo hecho, que crece sin límite, en cada carga. (b) Ruta nueva para la vista por defecto — duplicaría la lista y dejaría la antigua mezclando lo hecho con el resto, que FR-007 prohíbe. |
| Tres tests existentes (`show_task.spec.ts`, `update_task_status.spec.ts`, `task_overdue.spec.ts`) cambian su **helper** `fetchListed`/`fetchCreatedAt`. La constitución prohíbe editar un test *para que pase*. | Esos helpers leen `createdAt` de la lista sin filtro como fixture (para no depender de la serialización de Luxon), y seis de sus casos lo hacen sobre tareas `done`, que la lista sin filtro deja de traer: fallarían con un `TypeError`, no por una regresión de lo que verifican. El helper pasa a buscar en `GET /tasks` y `GET /tasks?status=done`; se cambia **antes** de implementar, en tarea propia, y es neutro (verde antes, porque `?status` se ignora; verde después, porque las dos vistas cubren todas las tareas). Ninguna aserción, título, dataset ni `expectedBody` cambia ([research §6](./research.md#6-tests-existentes-que-leen-createdat-de-la-lista-sin-filtro)). | (a) Leer `createdAt` del detalle — circular en `show_task.spec.ts`. (b) Serializarlo desde el modelo — la dependencia de Luxon que los helpers evitan. (c) No tocarlos — suite en rojo, bloqueada por `guard-tests.mjs`. |
