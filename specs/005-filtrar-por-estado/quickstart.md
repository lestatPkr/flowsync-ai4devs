# Quickstart: Filtrar la lista por estado

Guía de validación de punta a punta. Qué debe pasar en cada petición está en [contracts/task-list-api.md](./contracts/task-list-api.md); qué debe verse, en [contracts/task-list-ui.md](./contracts/task-list-ui.md). Aquí solo se dice cómo comprobarlo.

## Prerrequisitos

- Rama `feat/fs-142-filtrar-por-estado`, dependencias instaladas en `backend/` y `frontend/`, `.env` creado y migraciones aplicadas (`make setup` o los pasos de `CLAUDE.md`). **Este cambio no trae migración**: `node ace migration:run` no debe tener nada pendiente.
- Dos cuentas (p. ej. Oscar y Ana) para comprobar que el filtro es de cada cual.

## 0. Suite y comprobaciones automáticas

```bash
cd backend
npm test                                         # toda la suite en verde
node ace test --files=list_tasks_by_status       # la matriz nueva (15 escenarios)
node ace test --files=list_tasks                 # los tests de E2-1, sin editar, en verde
npm run test:coverage                            # cobertura de backend/app/ ≥ suelo (60 %)
npm run lint && npm run typecheck
git status .adonisjs/                            # el registro Tuyau de tasks.tasks.index gana `query`: commitearlo

cd ../frontend
npm run lint && npm run build                    # oxlint + typecheck + build
```

Esperado: todo en verde; `git diff backend/database/schema.ts` vacío; ninguna dependencia nueva en ningún `package.json` (`git diff --stat -- '*/package.json'` vacío).

**Rojo antes que verde** (principio II): con solo los tests nuevos y los helpers actualizados, antes de tocar validador y controlador, `node ace test --files=list_tasks_by_status` debe **fallar** (las hechas aparecen sin filtro, `?status=` se ignora, no hay `422`) y el resto de la suite debe seguir en verde.

## 1. La API (User Story 1, P1)

Con el backend arrancado (`npm run dev`) y un token (`POST /api/v1/auth/login`), crea al menos una tarea en cada estado (crear y cambiar con `PATCH /api/v1/tasks/:id/status`). Luego:

```bash
T="Authorization: Bearer <token>"
curl -s -H "$T" localhost:3333/api/v1/tasks                              # pendientes + en curso, ninguna hecha
curl -s -H "$T" 'localhost:3333/api/v1/tasks?status=done'                # solo las hechas
curl -s -H "$T" 'localhost:3333/api/v1/tasks?status=in_progress'         # solo en curso ([] si no hay: 200)
curl -s -i -H "$T" 'localhost:3333/api/v1/tasks?status=archivada'        # 422, field status, meta.choices
curl -s -i -H "$T" 'localhost:3333/api/v1/tasks?status='                 # 422
curl -s -i -H "$T" 'localhost:3333/api/v1/tasks?status=pending&status=done'   # 422
curl -s -i 'localhost:3333/api/v1/tasks?status=done'                     # 401, sin tareas
curl -s -H "$T" 'localhost:3333/api/v1/tasks?assigneeId=1'               # igual que sin query
```

Comprueba que ninguna de esas peticiones ha cambiado ninguna tarea (vuelve a pedir `?status=done` y la vista por defecto y compara).

## 2. La interfaz (User Story 2, P2)

Con `npm run dev` en `backend/` y en `frontend/`, entra en `http://localhost:5173/tasks`.

| # | Paso | Esperado |
|---|---|---|
| 1 | Abrir la lista | Vista por defecto: pendientes y en curso; ningún botón pulsado; la línea dice que las hechas no se muestran |
| 2 | Pulsar «Pendiente» | Solo pendientes; «Pendiente» pulsado; la línea dice «Filtrando por «Pendiente»…»; aparece «Quitar filtro» |
| 3 | Pulsar «En curso» | Solo en curso; sustituye a «Pendiente» |
| 4 | Pulsar «Quitar filtro» | Vuelve la vista por defecto |
| 5 | En la vista por defecto, pasar una tarea a «Hecho» desde su fila | La fila desaparece al guardarse, sin recargar; el foco no cae al vacío |
| 6 | Pulsar «Hecho» | La tarea del paso 5 está ahí; devolverla a «Pendiente» la saca de «Hecho» |
| 7 | Con «Hecho» aplicado, abrir una tarea y pulsar «Volver a la lista» | Sigue en «Hecho» y el foco vuelve a la tarea abierta |
| 8 | Con «Hecho» aplicado, recargar (⌘R) | Vista por defecto |
| 9 | Con «Hecho» aplicado, ir a Perfil, cerrar sesión y volver a entrar | Vista por defecto |
| 10 | Abrir `http://localhost:5173/tasks?status=done` y `?status=archivada` | Vista por defecto, sin filtro aplicado ni aviso |
| 11 | Filtrar por un estado sin tareas | «No hay tareas en este estado» (no el de espacio vacío, no un error) |
| 12 | Con «En curso» aplicado, crear una tarea | La lista pasa a la vista por defecto y la tarea nueva se ve arriba |
| 13 | Con todas las tareas en «Hecho», vista por defecto | «No hay nada pendiente ni en curso» con acceso a «Hecho»; **no** el «Todavía no hay tareas» |
| 14 | Espacio sin tareas (`node ace migration:fresh` en una BD de prueba), con y sin filtro | «Todavía no hay tareas» con «Crear tarea»; nunca «No hay tareas en este estado» |
| 15 | Parar el backend y pulsar un filtro | «No se ha podido cargar la lista» con «Reintentar»; ningún mensaje de vacío |
| 16 | En otra ventana (Ana), filtrar por «Hecho» | La ventana de Oscar no cambia de filtro |

**Filtro no válido en la interfaz** (FR-018): inalcanzable desde los botones. Para verlo, en las DevTools del navegador (Network → «Override content» sobre la respuesta de `GET /api/v1/tasks`) sustituir la respuesta por el `422` del contrato con estado 422: debe verse «Ese filtro no es válido» con «Volver a la vista por defecto». Opcional; la rama del servidor la cubren los tests.

## 3. Solo teclado (FR-021, SC-008)

Sin ratón: Tab hasta el grupo «Filtrar por estado», Enter en «Hecho», Tab a «Pendiente» y Enter, Tab a «Quitar filtro» y Enter. Cada acción es una pulsación; el filtro aplicado se sabe por la línea de estado (y el lector de pantalla anuncia «pulsado» y el cambio de la línea). Repetir el paso 5 de la tabla con teclado: tras guardar «Hecho», el foco queda en la fila siguiente.
