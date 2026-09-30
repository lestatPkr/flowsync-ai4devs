# Quickstart: validar FS-118 (fecha de vencimiento)

Guía para comprobar de punta a punta que la historia funciona. Los detalles de cada endpoint están en [contracts/](./contracts/), y la columna y la regla en [data-model.md](./data-model.md).

## Prerrequisitos

- Dependencias instaladas en `backend/` y `frontend/` (`npm install` en cada una). Sin dependencias nuevas.
- `backend/.env` creado (ver `CLAUDE.md`).
- Dos cuentas registradas (por ejemplo, Oscar y Ana) y al menos una tarea de cada una.

## 0. Migración, suite y comprobaciones automáticas

Desde `backend/`:

```bash
node ace migration:run          # añade due_date y regenera database/schema.ts
git diff database/schema.ts     # TaskSchema gana `dueDate: DateTime | null` con @column.date()
node ace migration:rollback     # el down quita la columna…
node ace migration:run          # …y se vuelve a aplicar limpia
npm test                        # verde, incluidas las matrices de contracts/
npm run test:coverage           # la cobertura de backend/app/ no baja del suelo
npm run lint && npm run typecheck
node ace list:routes            # aparece PUT /api/v1/tasks/:id/due-date, con auth
```

Desde `frontend/`:

```bash
npm run lint
npm run build                   # typecheck incluido
```

Esperado: todo en verde, y `backend/.adonisjs/` y `backend/database/schema.ts` con diff regenerado, sin ediciones a mano.

## 1. Crear sin fecha (US1, escenario 1)

1. `npm run dev` en `backend/` y en `frontend/`; iniciar sesión como Oscar.
2. Crear una tarea escribiendo solo el título.

Esperado: el formulario de creación no tiene campo de fecha ni la sugiere. Al abrir la tarea, «Vence el» está vacío, sin ningún aviso.

## 2. Poner, cambiar y quitar (US1)

1. Abrir la tarea; elegir en el campo una fecha dentro de dos semanas y salir del campo (Tab).
2. Recargar. → La fecha sigue ahí (SC-002).
3. Cambiarla por otra y recargar. → Queda la nueva.
4. Pulsar «Quitar fecha». → Queda sin fecha al instante, sin diálogo.
5. Poner otra vez una fecha, vaciar el campo del todo y salir. → Queda sin fecha, sin mensaje de error.
6. Abrir una tarea de Ana y ponerle fecha. → Se aplica sin advertencia (FR-009).

## 3. Fechas no válidas (US1, escenario 9)

1. Con una fecha guardada, borrar solo el día en el campo, dejando mes y año, y salir. → Mensaje junto al campo y vuelve la fecha guardada; tras recargar, la fecha sigue siendo la de antes.
2. Por la API, con un token válido:

```bash
curl -s -X PUT "http://localhost:3333/api/v1/tasks/<id>/due-date?today=2026-09-30" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"dueDate":"2026-02-31"}'
```

→ `422` con `rule: "date"` en `dueDate`, y un `GET` posterior devuelve la fecha anterior. Repetir con `"30/09/2026"` y `"mañana"`.

## 4. La regla y sus bordes (US2)

Por la API, sobre una tarea `pending` (sustituir `<id>` y `<token>`):

```bash
# poner fecha 2026-09-29
curl -s -X PUT "http://localhost:3333/api/v1/tasks/<id>/due-date" -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"dueDate":"2026-09-29"}'

for today in 2026-09-28 2026-09-29 2026-09-30; do
  curl -s "http://localhost:3333/api/v1/tasks/<id>?today=$today" -H "Authorization: Bearer <token>"; echo
done
```

Esperado: `isOverdue` es `false` con `2026-09-28` (la fecha es el día posterior a hoy), `false` con `2026-09-29` (mismo día) y `true` con `2026-09-30` (la fecha es el día anterior a hoy). Las tres respuestas traen el mismo `dueDate`.

- **Hecha**: pasar la tarea a «Hecho» desde la lista y repetir con `today=2026-09-30` → `isOverdue: false` y `dueDate` igual (CA-8, CA-9). Devolverla a «Pendiente» → vuelve a `true`.
- **Sin fecha**: `PUT` con `{"dueDate":null}` → la misma respuesta trae `isOverdue: false`.
- **Dos husos**: la pareja `today=2026-09-29` / `today=2026-09-30` sobre la misma tarea es el caso de CA-19: dos lecturas distintas, ambas correctas.

## 5. La señal en la vista (US2, escenario 1)

1. En la UI, poner a una tarea pendiente la fecha de ayer. → Aparece el texto **«Vencida»** junto a la fecha, al instante.
2. Poner la fecha de hoy. → «Vencida» desaparece (CA-5).
3. Poner la de mañana. → Sin señal.
4. Con la fecha de ayer, pasarla a «Hecho» desde la lista y abrirla. → Sin señal y con la misma fecha.
5. **Husos** (opcional): con la fecha de ayer, abrir la tarea en un navegador con la zona del sistema cambiada a una en la que aún sea «ayer» (por ejemplo, `Pacific/Honolulu` si aquí ya es pasada la medianoche). → Allí no aparece «Vencida»; aquí sí.

## 6. Lo que la lista no muestra (US3)

1. Con tareas sin fecha, con fecha futura y vencidas, mirar la lista. → Ninguna fecha ni marca de vencimiento; las filas muestran solo título, responsable y estado.
2. `curl -s http://localhost:3333/api/v1/tasks -H "Authorization: Bearer <token>"` → ninguna tarea tiene `dueDate` ni `isOverdue`.

## 7. Solo teclado (FR-019, SC-010)

Desde la lista: Tab hasta una tarea, Enter para abrirla, Tab hasta «Vence el», escribir una fecha con dígitos y flechas, Tab para guardar, Tab hasta «Quitar fecha» y Enter para quitarla. Todo sin ratón.

## 8. Sin sesión y tarea borrada

- `PUT` sin `Authorization` → `401` y la tarea no cambia.
- Borrar la tarea (en otra pestaña o directamente en la base) con la vista abierta y cambiar la fecha → aviso de que la tarea ya no existe con forma de volver a la lista.
