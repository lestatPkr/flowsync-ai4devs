# Quickstart: Abrir una tarea de la lista

Guía para validar de punta a punta que la historia funciona una vez implementada. No sustituye a los tests funcionales (Principio II): primero la suite en verde, luego la validación humana del flujo.

## Prerrequisitos

- Dependencias instaladas y BD migrada (flujo de 001, sin cambios): **este cambio no añade migraciones**, no hace falta `node ace migration:run`.
- Dos cuentas creadas (p. ej. «Oscar» y «Ana») y al menos una tarea de cada una, una de ellas en «Hecho» y otra con un título muy largo — créalas y cámbiales el estado desde la propia lista (flujos de E2-1 y E2-4).
- Backend: `cd backend && npm run dev`. Frontend: `cd frontend && npm run dev`.

## 0. Suite y comprobaciones automáticas

Desde `backend/`:

```bash
npm test                    # las 4 suites de tasks en verde, incluida show_task
npm run test:coverage       # la cobertura de backend/app/ no baja del suelo
npm run lint && npm run typecheck
node ace list:routes        # aparece GET /api/v1/tasks/:id (tasks.show) con middleware auth
git status .adonisjs        # client/registry/ y client/data.d.ts regenerados, listos para commitear
```

Desde `frontend/`:

```bash
npm run build && npm run lint
```

**Esperado**: todo en verde; `GET`/`POST /api/v1/tasks` y `PATCH /api/v1/tasks/:id/status` siguen listados igual que antes; `git diff` no toca `database/`, `package.json`, `app/exceptions/handler.ts`, `app/transformers/task_transformer.ts` ni ningún fichero de BOUNDARIES.md.

Contrato y matriz: [contracts/task-detail-api.md](./contracts/task-detail-api.md#matriz-de-comportamiento-definition-of-done).

## 1. Abrir y volver (User Story 1, P1)

1. Inicia sesión como Oscar y ve a `/tasks`. Anota el título, el responsable y el estado de una tarea tuya.
2. Haz clic en su título. **Esperado**: 1 clic; la URL pasa a `/tasks/<id>`; se ven el título, «Responsable», «Estado» y «Creada el» (p. ej. «29 de septiembre de 2026, 10:15»), y coinciden con lo anotado.
3. Comprueba que en la vista **no** hay ningún control para cambiar el estado, editar, reasignar ni borrar.
4. Recarga. **Esperado**: sigues en la misma tarea, con los mismos datos.
5. Pulsa «Volver a la lista». **Esperado**: 1 clic; estás en `/tasks`, y la tarea conserva título, responsable y estado.
6. Repite con una tarea de **Ana**. **Esperado**: igual que con la tuya, sin advertencia ni permiso; el responsable es Ana.
7. Abre la tarea en «Hecho» y la del título largo. **Esperado**: «Hecho» sin tratamiento especial; el título largo se lee entero en la vista, aunque la lista lo recorte.
8. En la lista, cambia el estado de una tarea con su control de la fila. **Esperado**: el estado cambia y la tarea **no** se abre.
9. Tras el paso 5, en `node ace repl` (desde `backend/`), la tarea abierta tiene el mismo `updatedAt` que antes de abrirla. Ver [data-model.md](./data-model.md#reglas-de-lectura).

Contrato: [contracts/task-detail-ui.md](./contracts/task-detail-ui.md#la-página-estados).

## 2. Solo teclado (FR-004, SC-005)

1. Sin tocar el ratón, `Tab` desde el campo de nueva tarea hasta el título (enlace) de una tarea de la mitad de la lista. **Esperado**: el anillo de foco es el mismo que el del campo de título.
2. `Enter`. **Esperado**: se abre esa tarea.
3. `Tab`. **Esperado**: el foco va a «Volver a la lista». `Enter`.
4. **Esperado**: de vuelta en la lista, el foco está en el enlace de la tarea que abriste; un `Tab` más lleva a su control de estado y el siguiente a la fila de abajo.

## 3. La tarea que ya no existe y los fallos de carga (User Story 2, P2)

| Caso | Cómo provocarlo | Esperado |
|---|---|---|
| Borrada después de cargar la lista | Con la lista abierta, borra una tarea desde `node ace repl` en `backend/` (`const { default: Task } = await import('#models/task'); await (await Task.findOrFail(<id>)).delete()`) y haz clic en su título | «Esta tarea ya no existe» + «Puede que alguien la haya borrado.»; enlace «Volver a la lista» (alcanzable con el primer `Tab`). En ningún momento aparece un título, responsable, estado o fecha. |
| Nunca existió | Ve a `/tasks/999999` y a `/tasks/abc` | El mismo aviso. |
| Sin conexión | Para el backend (`Ctrl+C`) y abre una tarea | «No se ha podido cargar la tarea» + «No se pudo conectar con el servidor…» + «Reintentar». **No** dice que la tarea no existe. Arranca el backend y pulsa «Reintentar»: se ve la tarea. |
| Sesión caducada | Con una tarea abierta, cierra sesión en otra pestaña y recarga la primera | Se aplica la autenticación existente: redirige a `/login`; no se ve nada de la tarea. |
| Sesión revocada sin recargar | Con la lista abierta, cierra sesión en otra pestaña y, en la primera, haz clic en el título de una tarea | «No se ha podido cargar la tarea» + «Tu sesión ha caducado. Vuelve a iniciar sesión.», sin «Reintentar» y sin ningún dato de la tarea. |
| Sin sesión | En una ventana privada, ve a `/tasks/<id>` | Redirige a `/login`; no se ve nada de la tarea. |
| API directa | `curl -i http://localhost:3333/api/v1/tasks/<id> -H "Accept: application/json"` | `401` con `{"errors":[{"message":"Unauthorized access"}]}` y ningún dato de la tarea. |
