# Implementation Plan: Fecha de vencimiento y tareas vencidas

**Branch**: `feat/fs-118-fecha-vencimiento-dry-run` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-fecha-vencimiento/spec.md`

## Summary

FS-118 añade a cada tarea una fecha de vencimiento opcional, que se pone, cambia y quita solo desde la vista de la tarea (E2-5), y una señal «Vencida» calculada en cada lectura con el «hoy» de quien mira.

- **Esquema**: columna `tasks.due_date` de tipo `date`, nullable, sin default, añadida con una migración nueva. `schema.ts` se regenera.
- **Regla**: vive en un único sitio, `Task.isOverdueOn(today)`, que compara días naturales `AAAA-MM-DD`.
- **API**: una ruta nueva, `PUT /api/v1/tasks/:id/due-date`. `GET /api/v1/tasks/:id` acepta `?today=` opcional (con respaldo en la fecha UTC del servidor) y su respuesta gana `dueDate` e `isOverdue`. La lista no cambia.
- **Frontend**: un `input type="date"` nativo en `task-page.tsx` que guarda al confirmar el valor, un botón «Quitar fecha» y el texto «Vencida».

⚠️ El cambio de forma de `GET /tasks/:id` choca con `BOUNDARIES.md` y con los tests de cuerpo completo de `show_task.spec.ts`. Está justificado abajo, pero **necesita visto bueno humano** antes de `/speckit-tasks` (Constitution Check, gate III).

## Technical Context

**Language/Version**: TypeScript 6 — backend en Node con AdonisJS 7; frontend en React 19

**Primary Dependencies**: AdonisJS 7, Lucid 22, VineJS 4, `@adonisjs/auth` 10, Luxon (ya instalado); React 19, Vite 8, react-router, shadcn/ui (`input`, `label`, `button`, `card`), Tailwind v4. **Ninguna nueva.**

**Storage**: SQLite (`backend/tmp/db.sqlite3`, compartida entre desarrollo y tests); columna nueva `tasks.due_date` (`date`, nullable)

**Testing**: Japa, suite `functional` (`backend/tests/functional/tasks/`), `npm test` y `npm run test:coverage` (c8) en `backend/`; sin runner de tests en el frontend (lint con oxlint y typecheck con `npm run build`)

**Target Platform**: navegador de escritorio actual (el `input type="date"` nativo está en todos los evergreen) contra la API en `localhost:3333`

**Project Type**: web application (monorepo `backend/` + `frontend/`, sin workspaces)

**Performance Goals**: lectura y guardado de la fecha sin espera perceptible (< 1 s a la escala de RNF-5), igual que la vista de E2-5

**Constraints**: la regla en un único sitio (el dominio); el día de referencia lo aporta el cliente en cada petición; ninguna ruta existente cambia de path ni de verbo; sin tocar la zona vallada; sin dependencias nuevas; estilo visual existente (R-8); textos en castellano (RNF-8)

**Scale/Scope**: el equipo de referencia del PRD (espacio único, pocas decenas de tareas); 1 columna, 1 ruta nueva, 1 ruta ampliada, 1 pantalla ampliada

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` v1.1.0 y `BOUNDARIES.md`.

| Principio | Estado | Cómo se cumple |
|---|---|---|
| **I. Producto antes que técnica** | ✅ | La spec no tiene rutas, tablas ni componentes; todo el CÓMO vive aquí, en `research.md`, `data-model.md` y `contracts/`. No quedan `[NEEDS CLARIFICATION]` (Clarifications 2026-09-30). |
| **II. Los tests son la spec ejecutable** | ✅ | P1 llega con tests funcionales Japa, escritos y ejecutados en rojo antes que la implementación. **Matriz completa del `PUT`**: camino feliz (#1–12), `422` (#13–18), `401` (#19–20) y `404` (#21–23), asertada contra el cuerpo completo más la relectura en base de datos ([task-due-date-api.md](./contracts/task-due-date-api.md)). **La regla** por sus bordes, a través de `GET /tasks/:id` con `today` explícito, incluidos los dos husos y el paso del día ([task-detail-api.md](./contracts/task-detail-api.md)). Un test nuevo comprueba que la lista no lleva los campos. Suelo de cobertura: `npm run test:coverage` no baja. |
| **III. La valla manda** | ⚠️ **pendiente de visto bueno humano** | ✅ No se toca la zona de auth. ✅ `schema.ts` solo se regenera. ✅ Rutas nuevas dentro de `middleware.auth()`. ✅ Sin dependencias nuevas. ⚠️ `GET /api/v1/tasks/:id` es una ruta pública existente y su **forma de respuesta cambia**: gana `dueDate` e `isOverdue`, y una rama `422` para `today` mal formado. La valla lo prohíbe y prevalece sobre el prompt; ver Complexity Tracking. |
| **IV. Convenciones del repo** | ✅ | Migración para el cambio de esquema (sin editar `schema.ts`); el modelo hereda la columna de la clase generada; respuestas por `serialize()` y transformer; validación con `vine.create` y `request.validateUsing`; imports por subpath (`#models/*`, `#validators/*`…); llamadas a la API solo en `lib/api.ts`; componentes de `components/ui/` sin editar; comandos desde cada carpeta. |
| **V. Cambios pequeños y con su spec** | ✅ | Un PR con `specs/004-fecha-vencimiento/` dentro. Los cinco tickets de FS-118 (migración → dominio → API → frontend → pruebas) son las fases de `tasks.md`. Revisión del `adversarial-reviewer` antes de cerrar. |

**Tests existentes afectados (principio II, «no se edita un test para que pase»)**: `show_task.spec.ts` aserta el cuerpo completo del detalle en 6 tests, y otro fija que el detalle es igual a la fila de la lista. Los 7 fallarán con los campos nuevos. La propuesta es actualizar sus expectativas como **cambio de comportamiento deliberado**:

- en la fase roja, **antes** de tocar el transformer, de modo que fallen contra el código actual y pasen después;
- en un commit propio, citado en el PR.

Queda sujeto al mismo visto bueno que el gate III. `create_task.spec.ts`, `list_tasks.spec.ts` (salvo el test nuevo que se añade) y `update_task_status.spec.ts` no se editan.

**Decisión registrada (T002, 2026-09-30)**: opción **(a)**, tomada por el agente de `/speckit-implement` bajo la instrucción de no preguntar, apoyándose en la entrada de `/speckit-plan`, donde la persona declaró el cambio del detalle aditivo y compatible con la valla. **Queda pendiente de ratificación humana en la revisión del PR**; si no se ratifica, se aplica la (b).

**Resultado del gate**: pasa I, II, IV y V. **III queda bloqueado hasta decisión humana** entre:

- **(a)**: aceptar el cambio aditivo del detalle, que es lo pedido en la entrada;
- **(b)**: mover `dueDate`/`isOverdue` a una ruta nueva `GET /tasks/:id/due-date` y dejar `GET /tasks/:id` y `show_task.spec.ts` intactos.

**Re-check tras el diseño (Phase 1)**: sin cambios. El diseño no introduce violaciones nuevas, y los contratos documentan la rama `422` nueva, el respaldo UTC y la lista intacta.

## Project Structure

### Documentation (this feature)

```text
specs/004-fecha-vencimiento/
├── spec.md
├── plan.md              # este archivo
├── research.md          # Phase 0: decisiones técnicas, §8 el conflicto con la valla
├── data-model.md        # Phase 1: columna due_date, regla, validación
├── quickstart.md        # Phase 1: guía de validación de punta a punta
├── contracts/
│   ├── task-due-date-api.md   # PUT /api/v1/tasks/:id/due-date + matriz
│   ├── task-detail-api.md     # cambios de GET /api/v1/tasks/:id + matriz de la regla
│   └── task-due-date-ui.md    # campo, botón y señal en task-page.tsx
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, no lo crea este comando)
```

### Source Code (repository root)

```text
backend/
├── database/
│   ├── migrations/<timestamp>_add_due_date_to_tasks.ts   # NUEVO (make:migration)
│   └── schema.ts                                         # REGENERADO, nunca a mano
├── app/
│   ├── models/task.ts                                    # + isOverdueOn(today)
│   ├── validators/task.ts                                # + updateTaskDueDateValidator, todayQueryValidator
│   ├── transformers/task_detail_transformer.ts           # + today por constructor, dueDate, isOverdue
│   ├── transformers/task_transformer.ts                  # SIN CAMBIOS (lista)
│   └── controllers/
│       ├── task_due_dates_controller.ts                  # NUEVO: update
│       └── tasks_controller.ts                           # show: valida today y lo pasa al transformer
├── start/routes.ts                                       # + router.put(':id/due-date', …) en el grupo tasks
├── .adonisjs/server/controllers.ts                       # REGENERADO
├── .adonisjs/client/registry/                            # REGENERADO
└── tests/functional/tasks/
    ├── update_task_due_date.spec.ts                      # NUEVO: matriz del PUT
    ├── task_overdue.spec.ts                              # NUEVO: la regla por GET /tasks/:id
    ├── list_tasks.spec.ts                                # + 1 test nuevo (la lista sin los campos)
    └── show_task.spec.ts                                 # ⚠️ expectativas actualizadas (ver gate III)

frontend/src/
├── lib/types.ts                                          # + TaskDetail (Task sin cambios)
├── lib/api.ts                                            # getTask → TaskDetail + today; + setDueDate; + localToday; translate 'date'
└── pages/task-page.tsx                                   # + fila «Vence el»: input date, «Quitar fecha», «Vencida»
```

**Structure Decision**: aplicación web ya existente, con `backend/` (AdonisJS) y `frontend/` (React). Se trabaja sobre esas carpetas sin crear ninguna nueva. Quedan **sin tocar**: `tasks-page.tsx`, `task-list.tsx`, el formulario de creación, `TaskTransformer`, `TaskStatusesController` y todo lo de la zona vallada de `BOUNDARIES.md`.

## Complexity Tracking

| Violación | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Cambiar la **forma de respuesta** de `GET /api/v1/tasks/:id` (campos `dueDate`/`isOverdue` y rama `422` de `today`), que `BOUNDARIES.md` prohíbe | La vista de la tarea es la única superficie de la fecha (RF-15, FR-003): abrir la tarea debe traer la fecha y la señal en una sola lectura, calculadas con el mismo `today`. El cambio es aditivo y ningún consumidor fuera de este repo usa la ruta. | **(b) Ruta nueva `GET /tasks/:id/due-date`**: cumple la valla al pie de la letra, pero añade una segunda petición al abrir la tarea (dos cargas y dos estados de error que coordinar en la vista) y un tercer transformer. No se descarta: es la salida si el visto bueno humano no llega. **Ignorar un `today` inválido** en vez de `422`: evitaría la rama nueva, pero escondería fallos del cliente y daría lecturas erróneas en silencio. |
| Actualizar expectativas de 7 tests de `show_task.spec.ts` | Asertan el cuerpo completo del detalle y la igualdad detalle = fila, que FS-118 cambia a propósito. Se actualizan en rojo antes de implementar, así que fallan antes y pasan después. | No actualizarlos es imposible con (a). Con (b) no hace falta tocarlos. |
