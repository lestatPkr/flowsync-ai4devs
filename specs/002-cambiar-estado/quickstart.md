# Quickstart: Cambiar el estado de una tarea desde la lista

Guía para validar de punta a punta que la historia funciona una vez implementada. No sustituye a los tests funcionales (Principio II): primero la suite en verde, luego la validación humana del flujo.

## Prerrequisitos

- Dependencias instaladas y BD migrada (flujo de 001, sin cambios): **este cambio no añade migraciones**, no hace falta `node ace migration:run`.
- Dos cuentas creadas (p. ej. «Oscar» y «Ana»), y al menos una tarea de cada una — créalas desde la propia lista (flujo de E2-1).
- Backend: `cd backend && npm run dev`. Frontend: `cd frontend && npm run dev`.

## 0. Suite y comprobaciones automáticas

Desde `backend/`:

```bash
npm test                    # las 3 suites de tasks en verde, incluida update_task_status
npm run test:coverage       # la cobertura de backend/app/ no baja del suelo
npm run lint && npm run typecheck
node ace list:routes        # aparece PATCH /api/v1/tasks/:id/status (tasks.task_statuses.update) con middleware auth
git status .adonisjs        # controllers.ts y client/registry/ regenerados, listos para commitear
```

Desde `frontend/`:

```bash
npm run build && npm run lint
```

**Esperado**: todo en verde; `GET`/`POST /api/v1/tasks` siguen listados igual que antes; `git diff` no toca `database/`, `package.json` ni ningún fichero de BOUNDARIES.md.

## 1. Cambiar el estado desde la fila (User Story 1, P1)

1. Inicia sesión como Oscar y abre la lista (`/tasks`).
2. En una tarea tuya en «Pendiente», cambia el estado a «En curso» con el control de la fila.
3. **Esperado**: sin abrir la tarea, sin diálogo, sin rellenar nada, y en 2 interacciones o menos (desplegar + elegir). La fila muestra «En curso».
4. Recarga la página. **Esperado**: sigue en «En curso».
5. Recorre las 6 transiciones: `Pendiente → Hecho`, `Hecho → En curso`, `En curso → Hecho`, `Hecho → Pendiente`, `Pendiente → En curso`, `En curso → Pendiente`. **Esperado**: todas se aceptan, incluidas las dos que salen de «Hecho».
6. Repite el paso 2 sobre una tarea de Ana. **Esperado**: igual que con una propia, sin aviso ni permiso especial, y el responsable sigue siendo Ana.
7. Abre el desplegable. **Esperado**: solo «Pendiente», «En curso» y «Hecho»; ninguna opción para crear, renombrar o borrar estados.

Contrato: [contracts/task-status-api.md](./contracts/task-status-api.md), [contracts/task-status-ui.md](./contracts/task-status-ui.md#el-control).

## 2. Reflejo inmediato y fila fiable (User Story 2, P2)

1. Escribe algo en el campo de nueva tarea **sin enviarlo** y desplázate hasta una tarea de la mitad de la lista.
2. Cámbiale el estado a «Hecho». **Esperado**: la fila cambia en el acto, sin recargar; la tarea sigue visible mostrando «Hecho»; el resto de filas, la posición de scroll y el texto a medio escribir no cambian.
3. Cambia varias veces seguidas el estado de la misma tarea (p. ej. con las flechas del teclado). Recarga. **Esperado**: queda en el último estado elegido, y es el que mostraba la fila.
4. Elige para una tarea el estado que ya tiene. **Esperado**: nada cambia y no aparece ningún error.

## 3. Errores: la fila nunca miente

| Caso | Cómo provocarlo | Esperado en la fila |
|---|---|---|
| Tarea que ya no existe | Con la lista abierta, borra la tarea desde `node ace repl` en `backend/` (`const { default: Task } = await import('#models/task'); await (await Task.findOrFail(<id>)).delete()`), y cambia su estado en el navegador | Vuelve al estado anterior + «Esta tarea ya no existe: puede que alguien la haya borrado…» |
| Sesión caducada | Con la lista abierta, cierra sesión en otra pestaña (revoca el token) y cambia un estado en la primera | Vuelve al estado anterior + «Tu sesión ha caducado. Vuelve a iniciar sesión.» |
| Sin conexión | Para el backend (`Ctrl+C`) y cambia un estado | Vuelve al estado anterior + «No se pudo conectar con el servidor…» |
| Estado no válido | Solo alcanzable fuera de la interfaz: `curl -X PATCH http://localhost:3333/api/v1/tasks/<id>/status -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -H "Accept: application/json" -d '{"status":"archived"}'` | `422` con `rule: "enum"`; recargando la lista, la tarea conserva su estado |

En ningún caso la fila termina mostrando como guardado un estado que no se guardó (SC-005). Tras cada caso, recarga y confirma que el estado mostrado coincide con el guardado.

## 4. Solo teclado (FR-015, SC-006)

1. Sin tocar el ratón, `Tab` desde el campo de nueva tarea hasta el control de estado de una fila.
2. Cambia el estado con las flechas o con `Espacio`/`Alt+↓` + `Enter`.
3. **Esperado**: el cambio se aplica, el foco se queda en el control y el anillo de foco es el mismo que el del campo de título.

## Validación cruzada con `data-model.md`

Tras el escenario 1, en `node ace repl`: la tarea tiene `status` en su valor interno (`in_progress`, no «En curso»), `title` y `assigneeId` sin cambios, y `updatedAt` posterior a `createdAt`. Ver [data-model.md](./data-model.md#qué-cambia-el-comportamiento-del-atributo-status).
