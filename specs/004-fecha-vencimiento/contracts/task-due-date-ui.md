# Contract: la fecha de vencimiento en la vista de la tarea

Cubre FR-001, FR-003 a FR-006, FR-008 a FR-010, FR-015 a FR-018, FR-020 y FR-021 en el lado del cliente. Interfaz entre las piezas del frontend y lo que ve el usuario. Decisiones y alternativas en [research.md §10-§11](../research.md#10-frontend-tipos-y-libapits).

**Qué no se toca**: `pages/tasks-page.tsx`, `components/tasks/*` (lista, fila, formulario de creación, selector de estado), `routes/`, `auth/`. La lista y la creación quedan exactamente como están (CA-1, CA-11).

## `lib/types.ts`

```ts
/** Espejo de `TaskDetailTransformer` del backend (app/transformers/task_detail_transformer.ts). */
export type TaskDetail = Task & {
  dueDate: string | null // 'AAAA-MM-DD'
  isOverdue: boolean
}
```

`Task` (espejo de `TaskTransformer`, la lista) no cambia.

## `lib/api.ts`

```ts
export function getTask(id: string, token: string): Promise<TaskDetail>
export function setDueDate(id: number, dueDate: string | null, token: string): Promise<TaskDetail>
```

- Las dos añaden `?today=<AAAA-MM-DD>` con la fecha **local** del navegador, calculada en cada llamada por un helper interno `localToday()` (`getFullYear`/`getMonth() + 1`/`getDate`, con ceros; nunca `toISOString()`).
- `setDueDate` → `PUT /api/v1/tasks/${id}/due-date?today=…` con cuerpo `{ dueDate }` ([task-due-date-api.md](./task-due-date-api.md)). `RequestOptions.method` admite `'PUT'`.
- Rechazan siempre con `ApiError`: `404` → `status: 404` y mensaje de tarea inexistente (como `getTask` hoy); `422` → `fieldErrors.dueDate` con el mensaje en castellano; sin conexión → `status: 0`.
- `FIELD_LABELS.dueDate = 'la fecha de vencimiento'`; `translate()` traduce `date` y `date.afterOrEqual` a: **«Esa fecha no existe o está incompleta. Escribe un día, un mes y un año de cuatro cifras.»**

## `pages/task-page.tsx`

Nueva fila en el `<dl>` de la tarjeta, después de «Creada el». Título, responsable, estado y creación siguen como texto de solo consulta (FR-020).

| Elemento | Detalle |
|---|---|
| Etiqueta | `<Label htmlFor="due-date">Vence el</Label>` en el `<dt>` |
| Campo | `<Input id="due-date" type="date">` no controlado (`defaultValue` = `dueDate ?? ''`, `key` que cambia con la fecha guardada y tras cada fallo); `aria-invalid` y `aria-describedby="due-date-error"` cuando hay error |
| Fecha en castellano | Con fecha, texto bajo el campo: «Vence el 30 de septiembre de 2026» (`Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' })` sobre `` `${dueDate}T00:00:00Z` ``). Sin fecha: nada — ni «Sin fecha» en rojo ni aviso (FR-001, CA-12) |
| Quitar | `<Button variant="outline" size="sm">Quitar fecha</Button>`, visible solo con fecha. Un clic o `Enter`/`Espacio`: guarda `null` al momento, sin confirmación (CA-15, SC-001). Después, el foco vuelve al campo |
| Señal «Vencida» | Texto **«Vencida»** (`text-destructive font-medium`), solo si `isOverdue === true`, dentro de una región `role="status"` que existe siempre (vacía si no está vencida), para que se anuncie cuando aparece o desaparece tras guardar. Se lee como texto, no depende del color (FR-015, SC-010). Nunca «vence hoy», «vence pronto» ni otra señal (FR-016) |
| Error | `<FieldError id="due-date-error">` (componente existente) bajo el campo |

### Comportamiento del campo

| El usuario… | La vista… |
|---|---|
| elige un día en el selector o termina de escribir un día completo (año ≥ 1000) | programa el guardado (~500 ms, se adelanta al perder el foco); al volver la respuesta, pinta `dueDate` e `isOverdue` de la respuesta, sin recargar (FR-006, CA-2) |
| sigue tecleando antes de que venza la espera | solo se guarda el último valor completo; nunca se solapan dos peticiones y solo se pinta la respuesta de la última |
| deja el campo con un día imposible o a medio escribir (`validity.badInput`) | muestra el mensaje de fecha inválida junto al campo; **no** envía nada; la tarea conserva su fecha (FR-008) |
| borra todos los segmentos | no envía nada; al perder el foco el campo vuelve a mostrar la fecha guardada (quitar es el botón) |
| pulsa «Quitar fecha» | guarda `null`; la fecha, el texto en castellano y «Vencida» desaparecen con la respuesta (CA-3) |

### Respuestas del guardado

| Resultado | La vista… |
|---|---|
| `200` | Reemplaza la tarea mostrada por la de la respuesta; borra cualquier error del campo |
| `422` | `fieldErrors.dueDate` junto al campo; el campo vuelve a la fecha guardada (CA-14) |
| Sin conexión / `5xx` | «No se ha podido guardar la fecha. Comprueba la conexión e inténtalo de nuevo.» junto al campo; el campo vuelve a la fecha guardada; no da el cambio por hecho (FR-009) |
| `401` | «Tu sesión ha caducado. Vuelve a iniciar sesión.» junto al campo, igual que las demás pantallas protegidas (sin tocar `auth/`) |
| `404` | Pasa al estado «Esta tarea ya no existe» que la página ya tiene, con «Volver a la lista» (FR-010) |

## Teclado (FR-018, SC-010)

`Tab` llega a «Volver a la lista» → campo de fecha → «Quitar fecha» (si hay). En el campo, los segmentos día/mes/año se editan con dígitos y flechas y el selector se abre con el atajo nativo del navegador. Poner, cambiar y quitar se completan sin ratón.
