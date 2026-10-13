# Implementation Plan: Borrar una tarea

**Branch**: `build/borrar` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-borrar-tarea/spec.md` y el modelo de amenazas `docs/security/threat-model-e2-10.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Cualquier miembro con sesión borra cualquier tarea, propia o ajena, desde la tarea abierta, tras confirmar en una pregunta que la nombra y dice que no hay vuelta atrás; la tarea desaparece de verdad, para todo el equipo, sin dejar rastro de quién la borró. Los guardarraíles: cancelar (botón, Escape, clic fuera) no toca nada y devuelve el foco; el foco nace en «Cancelar»; un doble clic o un Enter de más no confirman; borrar cuesta 3 interacciones frente a las 2 del cambio de estado y no vive en la lista ni en el tablero; borrar lo ya borrado se explica sin parecer un fallo; sin sesión no se borra nada. Y lo que pide el modelo de amenazas: una petición borra una tarea como mucho, un id manipulado no borra nada, la credencial solo vale en la cabecera, la aplicación no se deja incrustar y ninguna respuesta filtra datos ni autor.

Enfoque técnico: **backend** — `DELETE /api/v1/tasks/:id`, acción `destroy` de `TasksController`, dentro del grupo `tasks` con `middleware.auth()`. Valida que `:id` esté en forma canónica (SQLite convierte `01`, `1.0`, `1e0` y ` 1` en `1`: [research §2](./research.md#2-el-id-se-valida-en-forma-canónica-no-se-interpreta)) y si no lanza `E_ROW_NOT_FOUND`, que el manejador existente ya convierte en `404 { errors: [{ message: 'Row not found' }] }`; si existe, `task.delete()` y `204` sin cuerpo. CORS ya admite `DELETE`. **Frontend** — `deleteTask()` en `lib/api.ts`; botón «Borrar tarea» (`variant="destructive"`) en `task-page.tsx`; diálogo propio sobre `<dialog>` nativo con `showModal()` compuesto con `Button`, foco inicial en «Cancelar», Tab atrapado, guarda de 500 ms contra la doble activación; al borrar, vuelta a la vista de la que se vino con un aviso de un solo uso; con `404`, el estado «ya no existe» que ya tiene la página. Cabeceras anti-*framing* en el servidor de Vite. Tests **antes**: matriz Japa (21 casos) y matriz e2e (19 tests, con teclado y axe con el diálogo abierto). **Sin cambio de esquema, sin dependencias nuevas, sin tocar la valla.**

## Technical Context

**Language/Version**: TypeScript 6 (backend y frontend), Node.js (la versión ya fijada por el repo; sin cambios).

**Primary Dependencies**: Backend: AdonisJS 7, Lucid 22 (`findOrFail`, `delete()`, `errors.E_ROW_NOT_FOUND`), Auth 10 (guard `api`, sin cambios). Frontend: React 19, Vite 8, react-router 8.3 (`useNavigate` con `replace` y `state`, `useLocation`), Tailwind v4 (tokens de `src/index.css`), shadcn/ui ya generado (`Button`, `Card`, `Alert`), `<dialog>` nativo. **Ninguna dependencia nueva** (BOUNDARIES.md).

**Storage**: SQLite vía Lucid, tabla `tasks` existente. Se elimina una fila; **sin migración ni cambio de esquema** ([data-model.md](./data-model.md)).

**Testing**: Backend: Japa, suite `functional`, **nuevo** `backend/tests/functional/tasks/delete_task.spec.ts`, aislado con `testUtils.db().truncate()`, escrito y visto en **rojo** antes de la ruta y la acción ([matriz](./contracts/delete-task-api.md#matriz-de-comportamiento-definition-of-done)); cobertura con `npm run test:coverage`. Frontend: Playwright + `@axe-core/playwright` (ya aprobados), **nuevo** `frontend/e2e/delete-task.spec.ts`, escrito y visto en **rojo** antes de tocar el frontend ([matriz](./contracts/delete-task-ui.md#matriz-de-comportamiento-definition-of-done)); helpers nuevos solo en `frontend/e2e/support.ts` (`deleteTask`, `logOut`, `getTaskStatus`); `page.clock` para la guarda de 500 ms.

**Target Platform**: API HTTP en `localhost:3333`; SPA en `localhost:5173` (Chromium en los e2e).

**Project Type**: Web application (monorepo `backend/` + `frontend/`, sin workspaces).

**Performance Goals**: La tarea sale de la pantalla de quien borra en < 1 s tras confirmar (SC-002): un `DELETE` por clave primaria y una navegación en el cliente, sin recargar.

**Constraints**: Ruta nueva **dentro** de `middleware.auth()`; ninguna otra ruta cambia (path, verbo ni forma); `app/exceptions/handler.ts`, `config/cors.ts` y toda la zona vallada sin tocar; `database/schema.ts` sin regenerar; `components/ui/` sin editar; solo tokens de DESIGN.md; borrar solo desde la tarea abierta (CA-7); sin dependencias nuevas.

**Scale/Scope**: Espacio único compartido, 3-10 personas. Sin lista viva (E3): las demás personas ven el borrado en su siguiente carga.

Ningún punto queda en NEEDS CLARIFICATION. El único marcador de la spec (FR-012, desde dónde se borra) lo resuelve el input: solo desde la tarea abierta; se ha registrado en la sección «Clarifications» de la spec. Lo que la spec delegaba al plan —textos, cómo se confirma, adónde se vuelve, cómo se avisa— está en [research.md](./research.md).

### Dónde el plan se aparta del input, y por qué

1. **El id se valida en forma canónica** en la acción ([research §2](./research.md#2-el-id-se-valida-en-forma-canónica-no-se-interpreta)). Con `Task.findOrFail(params.id)` a secas, `DELETE /api/v1/tasks/01` borraría la tarea 1. El `404` resultante es el mismo del manejador (que no se toca), como pide el input.
2. **Tras borrar se vuelve a la vista de la que se vino**: la lista por defecto (lo que dice el input) y el tablero si la tarea se abrió desde él, que es lo que dice la spec (Assumptions) y lo que ya hace «Volver» ([research §10](./research.md#10-qué-pasa-al-confirmar)).
3. **Una guarda de 500 ms** en el diálogo, no pedida en el input, para que US2-3 (doble clic o doble tecla dejan la pregunta abierta) se cumpla: el foco inicial en «Cancelar» por sí solo haría que el segundo Enter cerrase la pregunta ([research §9](./research.md#9-un-doble-clic-o-un-enter-de-más-no-confirman-fr-010)).
4. **Ficheros existentes que cambian además de los nombrados**: `tasks-page.tsx` y `board-page.tsx` (el aviso de borrado, [research §11](./research.md#11-el-aviso-de-tarea-borrada-en-la-lista-y-en-el-tablero)), `frontend/vite.config.ts` (cabeceras anti-*framing*, [research §7](./research.md#7-que-la-aplicación-no-se-pueda-incrustar)) y DESIGN.md (patrón «Confirmación destructiva», sin tokens).
5. **Los dos botones de borrar usan `variant="destructive"`**: «Borrar tarea» en la página y «Borrar definitivamente» en el diálogo; «Cancelar» es `outline` del mismo tamaño ([research §16](./research.md#16-diseño)).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Contra `.specify/memory/constitution.md` **v1.2.0**.

| Principio | Evaluación |
|---|---|
| I. Producto antes que técnica | ✅ `spec.md` habla de «pedir borrar», «la pregunta», «la referencia a tarea», «el permiso por la vía actual» y «no se puede incrustar»; no nombra `DELETE`, `204`/`404`, `<dialog>`, cabeceras ni componentes. Todo eso está solo aquí y en los artefactos de diseño. El único marcador (FR-012) se cierra con la decisión del input, registrada en «Clarifications» sin meter CÓMO en la spec. Las decisiones de producto pendientes (quién borró, papelera, alta abierta, PA-8) no las resuelve el plan. |
| II. Los tests son la spec ejecutable | ✅ **Backend**: `delete_task.spec.ts` antes que la ruta y la acción, visto en rojo; **matriz completa** asertada contra el cuerpo entero (`deepEqual`, y cuerpo vacío en el `204`): camino feliz (propia, ajena, una entre varias, en `done` con fecha, ya no sale en `GET /tasks` ni en `?status=done`, ya no se abre), `401` (sin sesión, token inventado, token revocado, token en query, en cookie, sesión `web`) con la tarea intacta, `404` (inexistente, no numérico, borrar dos veces, formas que SQLite casaría, negativo, cero, compuesto, con SQL) con la tarea intacta, sin colección, sin fugas y `X-Frame-Options`. **`422` no aplica**: no hay cuerpo ni query, y un id inválido es `404` por diseño (FR-018); la constitución pide la rama «cuando aplique». **Frontend**: `delete-task.spec.ts` antes que el código, visto en rojo; un test por escenario de interfaz (US1-1…8, US2-1…8, US3-4, US3-5), titulado como el escenario, con el **camino solo con teclado** (US2-8) y **axe** sin violaciones graves ni críticas **con el diálogo abierto** (y en error, y con el aviso). `npm test` y `npm run test:e2e` en verde para abrir el PR; ningún test existente se edita. La cobertura de `backend/app/` no baja. |
| III. La valla manda | ✅ BOUNDARIES.md leído. Ningún fichero de la zona vallada: ni controladores ni middlewares de auth, ni `validators/user.ts`, ni `models/user.ts`, ni migraciones de `users`/`access_tokens`, ni `frontend/src/auth/` (solo se **usa** `useAuth()`). La ruta nueva va **dentro** de `middleware.auth()`; **ninguna ruta existente cambia**. Sin migración: `database/schema.ts` intacto. **Ninguna dependencia nueva** (el `<dialog>` es nativo; Playwright, axe y c8 ya aprobados). `handler.ts` y `cors.ts` no se tocan. Sin secretos. |
| IV. Convenciones del repo | ✅ Comandos desde `backend/`/`frontend/`. Controlador vía `#generated/controllers`, imports por subpath, `.adonisjs/` regenerado y commiteado. La respuesta de éxito no pasa por `serialize()` porque es un `204` **sin** cuerpo (no hay nada que transformar ni envolver); los errores mantienen la forma `{ errors }`. Llamada nueva solo en `lib/api.ts`, con el `404` en castellano. Componentes de `ui/` compuestos por fuera (`Button`, `Card`, `Alert`), sin rediseño. Prettier por el hook; oxlint; `npm run build` como typecheck. Sin cambio de esquema, sin migración. |
| V. Cambios pequeños, revisables y con su spec | ✅ Una historia (E2-10), un PR, en `specs/007-borrar-tarea/` con spec + plan + tasks. Tamaño: 1 ruta, 1 acción, 1 fichero Japa; 1 función de API, 2 componentes nuevos, 3 páginas retocadas, 1 config de Vite, 1 fichero e2e + 3 helpers, 1 viñeta en DESIGN.md. Orden: Japa en rojo → backend → e2e en rojo → frontend. Lo excluido (papelera, deshacer, borrado masivo, límite de ritmo, autoría, lista viva) no se construye. |
| VI. Una sola fuente de diseño | ✅ Solo tokens semánticos (`bg-card`, `text-card-foreground`, `border`, `backdrop:bg-background/80`, `text-muted-foreground`, `ring-ring/50`) y variantes de `Button` (`destructive`, `outline`). Ningún hex, `rgb()`, `oklch()`, color arbitrario ni paleta de Tailwind (por eso el *backdrop* no es `bg-black/50`). **Ningún token nuevo**: `index.css` no cambia; DESIGN.md gana solo el patrón «Confirmación destructiva». `components/ui/` no se edita y no se genera ningún componente nuevo de shadcn. |

**Resultado (pre-Phase 0)**: PASS. Sin violaciones que justificar.

**Re-check post-Phase 1**: PASS. El diseño añade piezas no nombradas en el input (punto «Dónde el plan se aparta del input»), todas fuera de la valla y sin cambiar ninguna ruta, forma de respuesta ni token: la validación canónica del id refuerza FR-018 sin tocar el manejador; la guarda de 500 ms y el aviso de borrado son interfaz pura; las cabeceras de Vite solo afectan al *framing* del servidor de desarrollo y de *preview*. Observación para el backlog, **no** para este cambio: `GET /tasks/:id`, `PATCH /tasks/:id/status` y `PUT /tasks/:id/due-date` aceptan las mismas formas no canónicas del id; cambiarlo alteraría rutas existentes.

## Project Structure

### Documentation (this feature)

```text
specs/007-borrar-tarea/
├── spec.md              # /speckit-specify (+ «Clarifications» de FR-012)
├── checklists/
│   └── requirements.md  # /speckit-specify
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── delete-task-api.md
│   └── delete-task-ui.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── controllers/
│   │   └── tasks_controller.ts              # + destroy: id canónico o E_ROW_NOT_FOUND; findOrFail; task.delete(); 204
│   ├── exceptions/handler.ts                # sin cambios (E_ROW_NOT_FOUND → 404 { errors })
│   └── models/task.ts                       # sin cambios
├── config/cors.ts                           # sin cambios (DELETE ya permitido)
├── start/routes.ts                          # + router.delete(':id', [controllers.Tasks, 'destroy']) dentro del grupo tasks
├── .adonisjs/client/registry/               # regenerado (tasks.tasks.destroy)
└── tests/functional/tasks/
    └── delete_task.spec.ts                  # nuevo, ANTES que la implementación

frontend/
├── vite.config.ts                           # + server.headers / preview.headers anti-framing
├── e2e/
│   ├── delete-task.spec.ts                  # nuevo, ANTES que la implementación
│   └── support.ts                           # + deleteTask, logOut, getTaskStatus
└── src/
    ├── lib/api.ts                           # + deleteTask(id, token); 'DELETE' en RequestOptions
    ├── components/tasks/
    │   ├── delete-task-dialog.tsx           # nuevo: <dialog> nativo + Button
    │   └── task-deleted-notice.tsx          # nuevo: «Se ha borrado «…».», un solo uso
    └── pages/
        ├── task-page.tsx                    # + «Borrar tarea», diálogo, navegación y paso a not-found
        ├── tasks-page.tsx                   # + TaskDeletedNotice
        └── board-page.tsx                   # + TaskDeletedNotice

DESIGN.md                                    # + patrón «Confirmación destructiva» en Components (sin tokens)
```

**Structure Decision**: Layout web existente, `backend/` (AdonisJS, API) + `frontend/` (React SPA), sin carpetas nuevas. `destroy` va en `TasksController` porque actúa sobre el recurso `tasks` entero, como `show`. El diálogo y el aviso son componentes propios en `components/tasks/`, junto a los demás de tareas; `components/ui/` no gana nada.

## Complexity Tracking

*No aplica: el Constitution Check no encontró violaciones.*
