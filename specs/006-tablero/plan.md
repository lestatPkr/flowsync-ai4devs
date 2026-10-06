# Implementation Plan: Tablero de tareas por estado

**Branch**: `build/kanban` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-tablero/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Una segunda vista de las tareas del equipo: un tablero con tres columnas fijas —«Pendiente», «En curso», «Hecho»— con su recuento, que enseña también lo hecho, donde cada tarjeta dice título, responsable y estado, abre la tarea y se mueve de columna arrastrando o, siempre, sin ratón con el mismo control de estado de la lista; el cambio se ve al instante y, si no se guarda, la tarjeta vuelve con un mensaje. Columnas vacías que lo dicen, columnas apiladas en pantallas estrechas, ida y vuelta con la lista en un clic, la lista como entrada, y todo operable con teclado.

Enfoque técnico: **solo frontend**. Ruta nueva `/tasks/board` dentro de `ProtectedRoute` y `TasksLayout`; página `pages/board-page.tsx` y componentes `components/board/board-column.tsx` y `board-card.tsx`, compuestos con `Card`, `Button` y `Alert` de `ui/` sin editarlos. Carga con **una lectura por columna** (`GET /api/v1/tasks?status=…` × 3, en paralelo) envuelta en `listTasksByStatus()` de `lib/api.ts`; mover usa el `PATCH /api/v1/tasks/:id/status` existente vía `updateTaskStatus`. Como al cambiar de columna React desmonta la tarjeta, la reconciliación optimista de `TaskStatusSelect` (una petición en vuelo por tarea, la última elección en cola, vuelta al último confirmado si falla) **sale del componente** a `lib/task-status-sync.ts`, indexada por tarea, y el control visible a `TaskStatusControl`; la lista sigue usando `TaskStatusSelect` con el mismo comportamiento, fijado antes con tests de caracterización. Arrastre con la **API nativa de HTML5**; el foco sigue a la tarjeta movida, a su control. Tests e2e con Playwright **antes** de implementar: un test por escenario de aceptación (27), más el caso límite de dos cambios seguidos, y axe en tres estados más el error de carga; los 29 se ven en rojo antes de implementar. Ninguna dependencia nueva, ningún token nuevo, la valla intacta.

## Technical Context

**Language/Version**: TypeScript 6 (frontend). El backend no se toca.

**Primary Dependencies**: React 19, Vite 8, react-router 8.3 (`Link` con `state`, `useLocation`, rutas anidadas), Tailwind v4 (tokens en `src/index.css`), shadcn/ui ya generado (`Card`, `Button`, `Alert`), `lucide-react` (`Columns3Icon`, `ListIcon`, `Loader2Icon`, ya instalado). Arrastre con la API nativa de HTML5 (`draggable`, `dragstart`/`dragover`/`drop`/`dragend`). **Ninguna dependencia nueva** (BOUNDARIES.md; ni dnd-kit ni similares).

**Storage**: N/A. Sin cambios de datos: el tablero lee y cambia lo que ya existe ([data-model.md](./data-model.md)). Estado de interfaz solo en memoria.

**Testing**: Playwright + `@axe-core/playwright` (ya aprobados e instalados), contra el backend real que arranca `playwright.config.ts`. **Nuevo** `frontend/e2e/board.spec.ts`: la matriz de las tres historias, un test por escenario titulado como él, escrito y ejecutado en **rojo** antes de la implementación ([contrato](./contracts/board-ui.md#matriz-de-comportamiento-definition-of-done)). **Nuevo** `frontend/e2e/task-status-list.spec.ts`: caracterización del control de estado de la lista, **verde** antes y después de extraer su reconciliación. Helpers nuevos solo en `frontend/e2e/support.ts` (`setTaskStatus`, `setTaskDueDate`, `scopeBoardTo`). Backend: `npm test` sigue en verde sin ningún cambio.

**Target Platform**: SPA en navegadores de escritorio (Chromium en los e2e); usable en pantallas estrechas con el control de estado (el arrastre táctil no se exige).

**Project Type**: Web application (monorepo `backend/` + `frontend/`); este cambio vive entero en `frontend/`.

**Performance Goals**: Abrir el tablero con ~200 tareas (RNF-5) en tres lecturas en paralelo, sin espera perceptible (SC-009); el movimiento se pinta antes de la respuesta del servidor, muy por debajo de 1 s (SC-004). Sin virtualización ni paginación (la spec no pone límite a «Hecho»).

**Constraints**: Backend intacto (rutas, modelos, transformers, tests); llamadas a la API solo en `lib/api.ts`; `components/ui/` y `frontend/src/auth/` sin tocar; solo tokens semánticos, y si hiciera falta un color nuevo, token en `index.css` (claro, oscuro, `@theme inline`) + DESIGN.md en el mismo cambio (no hace falta, [research §10](./research.md#10-diseño-tokens-y-componentes)); rejilla de tres columnas desde `md`, apiladas debajo, nunca scroll horizontal de página; regiones con `h2` y recuento, tarjetas en lista, foco que no se pierde al mover; la lista sigue siendo la entrada.

**Scale/Scope**: Espacio único compartido, 3-10 personas, ~200 tareas. Sin lista viva (E3-2): el tablero enseña lo que cargó.

Ningún punto queda en NEEDS CLARIFICATION: lo que la spec delegaba al plan —los textos exactos, cómo se señala el estado, cómo se vuelve de una tarea al tablero— se decide en [research.md](./research.md) (§5, §7, §10, §11) y se fija en el [contrato](./contracts/board-ui.md).

### Dónde el plan se aparta del input, y por qué

1. **`TaskStatusSelect` no se reutiliza tal cual: se parte en dos y la lista sigue igual.** Su reconciliación vive dentro del componente y la tarjeta se desmonta al cambiar de columna: la tarjeta no saltaría hasta la confirmación, un fallo nunca la devolvería y dos cambios seguidos irían en paralelo. La reconciliación pasa a `lib/task-status-sync.ts` (por id de tarea, fuera de React) y el `<select>` a `TaskStatusControl`; el tablero usa los dos, la lista los usa a través de `TaskStatusSelect` sin cambiar de comportamiento. Es un refactor, así que entra con **tests de caracterización** de la lista antes ([research §2](./research.md#2-la-reconciliación-optimista-por-qué-taskstatusselect-no-basta-tal-cual)).
2. **El mensaje de cambio no guardado lleva un prefijo**: «No se ha guardado el cambio.» + el mensaje de `lib/api.ts`. La spec exige que el mensaje diga que no se guardó (US2-5) y los de `lib/api.ts` no lo dicen; se compone en el tablero sin tocar `lib/api.ts`, y la lista conserva su mensaje sin prefijo ([research §11](./research.md#11-textos)).
3. **Algunos tests acotan lo que ve el tablero.** En una BD compartida no se puede garantizar una columna vacía ni un espacio vacío: para US3-1 a US3-4, el orden de tabulación de US1-9 y el axe con columnas vacías, `scopeBoardTo` hace la petición **real** y filtra las filas a las del test. Y como **no hay ruta de borrado**, la tarea borrada de US2-6 se simula con un `404` en `page.route` ([research §9](./research.md#9-tests-e2e-contra-una-base-de-datos-compartida)).
4. **La matriz es la de la spec, no solo la lista del input**: un test por cada uno de los 27 escenarios (incluidos US1-4 sin vencimiento, US1-6 volver al tablero, US1-8 entrada por la lista, US1-11 sin sesión, US2-3, US2-6, US2-8, US3-2, US3-4, US3-6, US3-7), más el caso límite de dos cambios seguidos.
5. **Tres ficheros existentes cambian además de `app-routes.tsx`**: `tasks-page.tsx` (enlace «Tablero» e importar `byListOrder`, que se mueve a `lib/task-status.ts`), `task-page.tsx` («Volver al tablero» cuando se llega desde el tablero, FR-005) y `task-status-select.tsx` (punto 1). Y `lib/api.ts` gana `listTasksByStatus`. En `tasks-layout.tsx` cambia **solo su JSDoc**: el filtro de la lista ya sobrevive a ir al tablero y volver ([research §7](./research.md#7-navegación-entre-lista-y-tablero-y-volver-desde-una-tarea)) y el comentario dice que solo se guarda al ir a una tarea.
6. **DESIGN.md gana dos patrones** (columna con recuento; destino al arrastrar) en «Components», sin tocar tokens: `index.css` no cambia ([research §10](./research.md#10-diseño-tokens-y-componentes)).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` **v1.2.0**.

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` habla de columnas, tarjetas, recuentos, «el control de estado de la lista», «vuelve a su columna» y pantallas estrechas; no nombra rutas, `draggable`, `role="region"`, `PATCH` ni componentes. Todo eso está solo aquí y en los artefactos de diseño. Lo que la spec dejó al plan (textos, cómo se vuelve al tablero, color de estado) se decide aquí sin reabrir la spec. La marca de vencida sigue fuera (decisión de producto pendiente, anotada en la spec), y el plan no la cuela. |
| II. Los tests son la spec ejecutable | ✅ Historia de interfaz → **matriz e2e** en `frontend/e2e/board.spec.ts`: un test por escenario de aceptación (11 de US1, 9 de US2, 7 de US3), titulado como el escenario, **escrito antes y visto en rojo**, todos sin excepción (29 ✗ antes de implementar; US1-11 incluido: sin sesión lleva a `/login` y, tras `signIn`, `/tasks/board` muestra el `h1` «Tablero», así que hoy falla por la razón correcta); incluye el camino **solo con teclado** (US1-9, US2-2, US3-6) y **axe** sin violaciones graves ni críticas en tres estados (SC-007, `expectNoSeriousA11yViolations`) y en el error de carga (US1-10). El refactor de `TaskStatusSelect` va precedido de **tests de caracterización** (`task-status-list.spec.ts`, verdes antes y después, sin cambiar aserciones). `npm run test:e2e` en verde para abrir el PR. Ningún test existente se edita ni se borra; `smoke.spec.ts` sigue igual. Backend: ningún endpoint cambia, así que no hay matriz Japa nueva y `npm test` sigue en verde sin tocarse; la cobertura Japa de los dos endpoints que usa el tablero ya existe: `backend/tests/functional/tasks/list_tasks_by_status.spec.ts` (`GET /api/v1/tasks?status=…`, la carga de cada columna en US1) y `backend/tests/functional/tasks/update_task_status.spec.ts` (`PATCH /api/v1/tasks/:id/status`, mover en US2). En el frontend no hay suelo de cobertura. |
| III. La valla manda | ✅ BOUNDARIES.md leído. Ningún fichero de la zona vallada: ni `frontend/src/auth/` (el tablero solo **usa** `useAuth()`, como la lista) ni nada del backend. `backend/database/schema.ts` no cambia. **Ninguna ruta pública cambia ni se añade** en `/api/v1`: `/tasks/board` es una ruta del cliente. **Ninguna dependencia nueva** (arrastre nativo; Playwright y axe ya aprobados). Sin secretos. |
| IV. Convenciones del repo | ✅ React 19 + Vite en `frontend/`, comandos desde `frontend/`. Llamadas a la API solo en `lib/api.ts` (`listTasksByStatus`, `updateTaskStatus`), con los mensajes en castellano que ya produce. Componentes de `ui/` compuestos por fuera (`Card` con `role="region"`, `Button asChild`, `Alert`), sin rediseño: tarjeta y vacíos siguen los patrones de la lista y de DESIGN.md. Alias `@/`. Prettier por el hook; `npm run lint` (oxlint) y `npm run build` (typecheck de `src/` y `e2e/`). Sin cambio de esquema, así que ninguna migración. |
| V. Cambios pequeños, revisables y con su spec | ✅ Una feature, un PR, en `specs/006-tablero/` con spec + plan + tasks. Tamaño: 1 página, 2 componentes de tablero, 1 control extraído, 1 módulo de sincronización, 1 función de API, 1 ruta, 3 ficheros existentes con cambios acotados (más un comentario en `tasks-layout.tsx`), 2 ficheros de e2e + 3 helpers, y 2 viñetas en DESIGN.md. Orden de commits en [research §13](./research.md#13-reparto-del-trabajo): caracterización → extracción → e2e en rojo → US1 → US2 → US3. Lo que la spec deja fuera (crear, filtrar, reordenar, vencida, en vivo) no se construye. |
| VI. Una sola fuente de diseño | ✅ Solo tokens semánticos (`bg-card`, `bg-muted/40`, `bg-secondary`/`text-secondary-foreground`, `text-muted-foreground`, `bg-accent`, `border-ring`, `text-destructive`); ningún hex, `rgb()`, `oklch()`, color arbitrario ni paleta de Tailwind en los componentes propios. **Ningún token nuevo**, así que `index.css` no cambia; DESIGN.md solo gana dos patrones de componente, sin valores. `components/ui/` no se edita. Del prototipo de Stitch no entra ningún color ni componente: prioridades, avatares, «+ Añadir columna» y su paleta quedan fuera, como dice la spec. |

**Resultado (pre-Phase 0)**: PASS. Un punto a justificar en Complexity Tracking (refactor de `TaskStatusSelect`).

**Re-check post-Phase 1**: PASS. El diseño concreta cuatro puntos sin salir de la valla ni de la constitución:

1. **La reconciliación es una sola**, en `lib/task-status-sync.ts`, compartida por la lista y el tablero; select y arrastre entran por la misma puerta y comparten cola ([research §2](./research.md#2-la-reconciliación-optimista-por-qué-taskstatusselect-no-basta-tal-cual)).
2. **El arrastre es un atajo de ratón**, sin ARIA de arrastre obsoleta; el camino garantizado es el control, y un anuncio `role="status"` cuenta lo que pasa porque la tarjeta se desmonta al moverse ([research §4](./research.md#4-accesibilidad-del-arrastre-nativo)).
3. **El foco sigue a la tarjeta, a su control**, también en la vuelta atrás, sin robarlo si la persona ya está en otra parte ([research §5](./research.md#5-adónde-va-el-foco-al-mover)).
4. **Los e2e son deterministas en una BD compartida** sin tocar el backend: títulos únicos, diferencias de recuento y `scopeBoardTo` con la respuesta real filtrada ([research §9](./research.md#9-tests-e2e-contra-una-base-de-datos-compartida)).

## Project Structure

### Documentation (this feature)

```text
specs/006-tablero/
├── spec.md              # /speckit-specify
├── checklists/
│   └── requirements.md
├── plan.md              # Este fichero
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (sin cambios de datos)
├── quickstart.md        # Phase 1
├── contracts/
│   └── board-ui.md      # Phase 1: ruta, regiones, nombres accesibles, mensajes, foco, matriz e2e
└── tasks.md             # Phase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
DESIGN.md                                   # MOD: dos patrones del tablero en «Components» (sin tokens)

frontend/
├── src/
│   ├── lib/
│   │   ├── api.ts                          # MOD: + listTasksByStatus(token)
│   │   ├── task-status.ts                  # MOD: + byListOrder (movida desde tasks-page.tsx)
│   │   └── task-status-sync.ts             # NEW: reconciliación optimista por tarea
│   ├── components/
│   │   ├── board/
│   │   │   ├── board-column.tsx            # NEW: región + h2 con recuento + lista o vacía + destino de soltar
│   │   │   └── board-card.tsx              # NEW: tarjeta arrastrable con título, responsable y control
│   │   ├── tasks/
│   │   │   ├── task-status-control.tsx     # NEW: el <select> de estado, controlado
│   │   │   └── task-status-select.tsx      # MOD: misma API; por dentro, control + sincronización
│   │   └── ui/                             # SIN CAMBIOS (generado por shadcn)
│   ├── pages/
│   │   ├── board-page.tsx                  # NEW: carga, estados, sincronización, arrastre, foco, anuncios
│   │   ├── tasks-page.tsx                  # MOD: enlace «Tablero»; importa byListOrder
│   │   └── task-page.tsx                   # MOD: «Volver al tablero» si se llega desde el tablero
│   ├── routes/
│   │   ├── app-routes.tsx                  # MOD: + /tasks/board dentro de ProtectedRoute y TasksLayout
│   │   └── tasks-layout.tsx                # MOD: solo el JSDoc (el filtro sobrevive también al tablero)
│   ├── auth/                               # SIN CAMBIOS (valla)
│   └── index.css                           # SIN CAMBIOS (ningún token nuevo)
└── e2e/
    ├── support.ts                          # MOD: + setTaskStatus, setTaskDueDate, scopeBoardTo
    ├── board.spec.ts                       # NEW: matriz del tablero (antes que la implementación, en rojo)
    ├── task-status-list.spec.ts            # NEW: caracterización del control en la lista (verde antes y después)
    └── smoke.spec.ts                       # SIN CAMBIOS

backend/                                    # SIN CAMBIOS
```

**Structure Decision**: aplicación web con `backend/` y `frontend/`; este cambio vive entero en `frontend/` (más dos viñetas en `DESIGN.md`). Los componentes del tablero van en `components/board/` y lo compartido con la lista (control de estado, sincronización, orden) en `components/tasks/` y `lib/`, para que la lista y el tablero no tengan dos versiones de lo mismo.

## Complexity Tracking

| Decisión que roza la constitución | Por qué hace falta | Alternativa más simple, descartada porque |
|---|---|---|
| Se refactoriza `TaskStatusSelect` (componente existente de la lista, sin e2e propios) para extraer su reconciliación a `lib/task-status-sync.ts` y su `<select>` a `TaskStatusControl`. El principio II exige fijar antes el comportamiento con tests de caracterización y no cambiarlo. | En el tablero la tarjeta cambia de columna y React la desmonta: el estado que hoy vive dentro del componente (confirmado, en vuelo, cola) se perdería, y con él la vuelta atrás si falla (FR-015, SC-005) y el orden de dos cambios seguidos. Tiene que vivir fuera del componente y por tarea. Se escriben antes 4 tests de caracterización de la lista (`task-status-list.spec.ts`), verdes contra el código actual; tras el refactor siguen verdes sin tocar ninguna aserción. La API pública de `TaskStatusSelect` y su comportamiento en la lista no cambian. | (a) Reutilizarlo sin tocar: la tarjeta no salta hasta confirmar y un fallo la deja en la columna equivocada. (b) Props opcionales con el estado aún dentro: el desmontaje sigue perdiendo cola y confirmado. (c) Copiar el bucle en el tablero: dos reconciliaciones que divergen. (d) Pintar todas las tarjetas bajo un mismo padre para evitar el desmontaje: rompe «tarjetas en una lista dentro de su columna» y el orden de tabulación. |
