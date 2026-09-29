# Quickstart: Fecha de vencimiento y tareas vencidas

Guía para validar de punta a punta que la historia funciona una vez implementada. No sustituye a los tests funcionales (Principio II): primero la suite en verde, luego la validación humana del flujo.

## Prerrequisitos

- Dependencias instaladas y `.env` del backend creado (flujo de 001, sin cambios). **Este cambio añade una migración**: hay que correrla.
- Dos cuentas («Oscar» y «Ana») y varias tareas de cada una, creadas desde la lista (E2-1); al menos una pasada a «Hecho» desde la fila (E2-4).
- Backend: `cd backend && npm run dev`. Frontend: `cd frontend && npm run dev`.

## 0. Migración, suite y comprobaciones automáticas

Desde `backend/`:

```bash
node ace migration:run      # añade tasks.due_date y regenera database/schema.ts
git diff database/schema.ts # solo cambia TaskSchema: + dueDate (@column.date, DateTime | null)
node ace migration:rollback && node ace migration:run   # el down quita la columna y el up la vuelve a poner
npm test                    # las suites de tasks en verde, incluidas update_task_due_date y task_overdue
npm run test:coverage       # la cobertura de backend/app/ no baja del suelo (60 %)
npm run lint && npm run typecheck
node ace list:routes        # aparece PUT /api/v1/tasks/:id/due-date con middleware auth; el resto, igual
git status .adonisjs        # controllers.ts, client/registry/ y client/data.d.ts regenerados, listos para commitear
```

Desde `frontend/`:

```bash
npm run build && npm run lint
```

**Esperado**: todo en verde; las tareas que ya existían siguen apareciendo en la lista igual que antes; `git diff` no toca `package.json` de ningún lado, `app/transformers/task_transformer.ts`, `app/exceptions/handler.ts`, `config/`, `frontend/src/pages/tasks-page.tsx`, `frontend/src/components/tasks/`, ni ningún fichero de BOUNDARIES.md; `database/schema.ts` cambia **solo** por la regeneración.

Contratos y matrices: [contracts/task-due-date-api.md](./contracts/task-due-date-api.md#matriz-de-comportamiento-definition-of-done), [contracts/task-detail-api.md](./contracts/task-detail-api.md#matriz-de-comportamiento-definition-of-done). Vista: [contracts/task-due-date-ui.md](./contracts/task-due-date-ui.md).

## 1. Poner, cambiar y quitar (User Story 1, P1)

1. Como Oscar, en `/tasks`, abre una tarea tuya sin fecha. **Esperado**: fila «Vence el» con el campo vacío, sin aviso de que falte nada y sin «Vencida».
2. Elige en el selector una fecha de la semana que viene. **Esperado**: bajo el campo aparece «Vence el <día> de <mes> de <año>» sin pulsar nada más; sin «Vencida».
3. Recarga la página. **Esperado**: la misma fecha. Como Ana, en otro navegador, abre esa tarea: la misma fecha.
4. Cámbiala por otra. **Esperado**: se ve la nueva; al recargar, sigue la nueva.
5. Pulsa «Quitar fecha». **Esperado**: sin diálogo; el campo queda vacío, el texto desaparece, el botón también y el foco queda en el campo. Al recargar, sin fecha.
6. Pon una fecha de hace un mes. **Esperado**: se acepta sin avisos y aparece «Vencida» (CA-13).
7. Como Oscar, abre una tarea de **Ana** y repite 2, 4 y 5. **Esperado**: igual que con las tuyas, sin advertencias (CA-17).
8. Vuelve a la lista. **Esperado**: ninguna fila muestra fecha ni «Vencida»; cada fila, igual que antes (CA-11).

## 2. Fechas inválidas y fallos (CA-14, FR-009, FR-010)

1. Con una tarea con fecha, escribe a mano en el campo un 31 de abril (o un 29 de febrero de 2025) y sal del campo. **Esperado**: el mensaje «Esa fecha no existe o está incompleta…» junto al campo; al recargar, la tarea tiene la fecha de antes.
2. Deja el año a medio escribir (dos cifras) y sal del campo. **Esperado**: mismo mensaje; no se guarda nada.
3. Para el backend (`Ctrl+C`) y cambia la fecha. **Esperado**: «No se ha podido guardar la fecha…» junto al campo y el campo vuelve a la fecha guardada. Arranca el backend y recarga: la fecha de antes.
4. Abre una tarea en dos pestañas; en una, bórrala (vía `node ace repl` → `(await import('#models/task')).default.findOrFail(<id>).then(t => t.delete())`); en la otra, cambia la fecha. **Esperado**: «Esta tarea ya no existe» con «Volver a la lista».
5. Comprueba el `422` del backend sin el navegador:

   ```bash
   curl -s -X PUT "http://localhost:3333/api/v1/tasks/<id>/due-date?today=2026-09-30" \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"dueDate":"2026-02-31"}'
   ```

   **Esperado**: `{"errors":[{"message":"The dueDate field must be a datetime value","rule":"date","field":"dueDate"}]}`, y la tarea con la fecha de antes.

## 3. La regla y sus bordes (User Story 2, P2)

Con `curl` y `today` explícito sobre una tarea `pending` (token de `localStorage['flowsync.token']` o de `POST /api/v1/auth/login`):

| Pon `dueDate` | `GET /api/v1/tasks/<id>?today=2026-09-30` → `isOverdue` |
|---|---|
| `2026-09-29` | `true` |
| `2026-09-30` | `false` |
| `2026-10-01` | `false` |
| `null` | `false` |

Luego, con `2026-09-29`:

1. `?today=2026-09-29` → `false`; `?today=2026-09-30` → `true`; `dueDate` idéntico en las dos (dos husos, CA-19).
2. Pásala a «Hecho» desde la lista y ábrela. **Esperado**: sin «Vencida» y con la misma fecha (CA-8). Devuélvela a «Pendiente»: vuelve «Vencida» con la misma fecha.

En el navegador:

3. Pon a una tarea la fecha de **hoy**. **Esperado**: sin «Vencida» (CA-5).
4. Cambia el huso del sistema (o en Chrome DevTools → Sensors → Location, un huso donde ya sea mañana) y recarga. **Esperado**: la misma fecha escrita y ahora «Vencida» (CA-19/CA-20: el día lo pone quien mira, al mirar).
5. Con una tarea vencida abierta, aplaza la fecha a la semana que viene. **Esperado**: «Vencida» desaparece sin recargar (CA-10).

## 4. Solo teclado y accesibilidad (FR-018, SC-010)

1. Abre una tarea y recorre con `Tab`: «Volver a la lista» → campo de fecha → «Quitar fecha» (si hay).
2. En el campo, escribe una fecha con dígitos (o flechas) y sal con `Tab`. **Esperado**: se guarda.
3. Con `Tab` hasta «Quitar fecha» y `Enter`. **Esperado**: se quita y el foco queda en el campo.
4. Con un lector de pantalla (VoiceOver: `Cmd+F5`), pon una fecha pasada. **Esperado**: se anuncia «Vencida». La señal es texto, visible también en escala de grises.

## 5. Lo que no aparece (User Story 3, P3)

1. Crea una tarea nueva desde la lista. **Esperado**: el formulario sigue pidiendo solo el título; al abrirla, sin fecha y sin avisos (CA-1).
2. Con tareas con fecha, vencidas y sin fecha, mira la lista. **Esperado**: ninguna fecha, ninguna «Vencida» (CA-11).
3. Pon a una tarea la fecha de mañana y ábrela. **Esperado**: ni «vence mañana» ni «vence pronto»; solo la fecha (FR-016).
