# Contract: la fecha en la vista de la tarea (`frontend/src/pages/task-page.tsx`)

Cubre, en el lado del cliente, FR-001 a FR-005, FR-007, FR-008, FR-013, FR-015, FR-016, FR-019 y FR-020. Se construye sobre la vista de E2-5 ([specs/003-abrir-tarea/contracts/task-detail-ui.md](../../003-abrir-tarea/contracts/task-detail-ui.md)), sin rehacerla. La lista (`tasks-page.tsx`, `task-list.tsx`) y el formulario de creación **no se tocan**.

## Qué se ve

Una fila nueva en el `<dl>` existente, después de «Creada el»:

| Estado de la tarea | `<dt>` | `<dd>` |
|---|---|---|
| Sin fecha | «Vence el» | campo de fecha vacío; ningún aviso ni texto de falta (FR-016) |
| Con fecha, no vencida | «Vence el» | campo con la fecha + botón «Quitar fecha» |
| Con fecha, vencida (`isOverdue: true`) | «Vence el» | campo con la fecha + texto **«Vencida»** + botón «Quitar fecha» |

- **«Vencida»** es texto visible, no solo color. Los tokens de error de `src/index.css` solo lo refuerzan. No cuenta días ni hay avisos intermedios («vence hoy»).
- El campo lleva `<Label>` asociado (`htmlFor`) con el texto «Vence el», y el mensaje de error queda enlazado con `aria-describedby`; la señal «Vencida» forma parte del texto accesible del `<dd>`.
- Componentes: `ui/input` (`type="date"`), `ui/label`, `ui/button`. Ninguno nuevo ni editado a mano.

## Cuándo guarda

| El miembro… | Resultado |
|---|---|
| elige o escribe una fecha completa y sale del campo (o pulsa Enter) | `setDueDate(id, 'AAAA-MM-DD')`; la vista muestra la fecha al instante |
| vacía el campo del todo y sale | `setDueDate(id, null)`: se quita la fecha, sin confirmación ni error (FR-005) |
| pulsa «Quitar fecha» | `setDueDate(id, null)`, sin confirmación |
| deja la fecha a medio escribir (`validity.badInput`) | **no** se llama a la API: mensaje junto al campo y se restaura la fecha guardada (FR-007) |
| sale sin cambiar nada | no se llama a la API |

- No hay botón de guardar ni diálogo de confirmación (CA-15, CA-16).
- Mientras la petición está en curso el campo sigue usable. Si se hace otro cambio, cuenta el último.

## Respuestas y errores

| Resultado de `setDueDate` | La vista |
|---|---|
| `200` | pinta `dueDate` e `isOverdue` **de la respuesta** (la señal aparece o desaparece al instante) |
| `422` (`fieldErrors.dueDate`) | restaura la fecha guardada y muestra el mensaje traducido junto al campo |
| `404` | aviso de que la tarea ya no existe con forma de volver a la lista (mismo trato que E2-5) |
| `401` | el trato de sesión caducada que ya da `api.ts` |
| fallo de red u otro | restaura la fecha guardada y explica, en castellano, que no se pudo guardar y qué hacer (FR-008) |

## Llamadas (`frontend/src/lib/api.ts`)

- `getTask(id, token): Promise<TaskDetail>` añade `?today=<localToday()>`.
- `setDueDate(id: number, dueDate: string | null, token: string): Promise<TaskDetail>`: `PUT /api/v1/tasks/:id/due-date?today=<localToday()>` con cuerpo `{ dueDate }`.
- `localToday()`: `AAAA-MM-DD` a partir de `getFullYear()`, `getMonth() + 1` y `getDate()` del navegador. Nunca `toISOString()`.
- `translate()`: `case 'date'` → «Esa fecha no existe. Escríbela completa, con día, mes y año.»; `FIELD_LABELS.dueDate = 'la fecha de vencimiento'`.

## Teclado

Todo se hace con el teclado: Tab llega al campo, las flechas y los dígitos cambian la fecha, Enter o Tab la guardan, Tab llega a «Quitar fecha» y Enter o Espacio la quitan (FR-019).
