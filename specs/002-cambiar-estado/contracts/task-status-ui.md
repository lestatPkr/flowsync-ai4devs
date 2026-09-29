# Contract: control de estado en la fila de la lista

Cubre FR-001, FR-002, FR-005, FR-011 a FR-015. Interfaz entre las piezas del frontend y lo que ve el usuario. Decisiones y alternativas en [research.md §6-§8](../research.md#6-control-de-estado-en-la-fila).

## `lib/api.ts`

```ts
export function updateTaskStatus(id: number, status: TaskStatus, token: string): Promise<Task>
```

- `PATCH /api/v1/tasks/${id}/status` con `{ status }` y `Authorization: Bearer <token>`; resuelve con la tarea de `data` ([task-status-api.md](./task-status-api.md#respuesta--éxito-200)).
- Rechaza siempre con `ApiError` (`status` HTTP, o `0` si no hay conexión) y `message` ya en castellano (ver [Mensajes](#mensajes)).
- `RequestOptions.method` admite `'PATCH'`.

## Componentes

| Pieza | Props / cambio | Responsabilidad |
|---|---|---|
| `pages/tasks-page.tsx` | + `handleUpdated(task: Task)` | Sustituye en `tasks` el elemento con el mismo `id`; no reordena, no recarga, no toca el formulario de creación (FR-014). |
| `components/tasks/task-list.tsx` | `{ tasks, token, onTaskUpdated }` | En cada fila: título, responsable y `<TaskStatusSelect>` en lugar de la píldora de estado. Mantiene `STATUS_LABELS`. |
| `components/tasks/task-status-select.tsx` (nuevo) | `{ task, token, onUpdated }` | El `<select>` de la fila, su estado local (valor mostrado, petición en vuelo, cambio pendiente) y su mensaje de error. |

## El control

- `<select>` nativo con tres `<option>` y solo tres: `pending` «Pendiente», `in_progress` «En curso», `done` «Hecho», en ese orden (FR-005). Ninguna opción para añadir, renombrar o borrar estados.
- Clases base de `ui/input.tsx` (borde, radio, `shadow-xs`, `focus-visible:ring`, `aria-invalid:border-destructive`, `dark:bg-input/30`), ancho automático, `text-sm`. No se añade nada a `ui/` ni a `package.json`.
- `aria-label="Estado de «{task.title}»"`; con error, `aria-invalid="true"` y `aria-describedby` apuntando al mensaje.
- Nunca `disabled` durante la petición (se perdería el foco con teclado).

## Comportamiento

| Situación | Lo que muestra la fila |
|---|---|
| Carga inicial | El `status` de la tarea tal como lo devuelve `GET /api/v1/tasks`. |
| El usuario elige un estado | Ese estado, en el acto (<1 s, SC-002); se envía el `PATCH`. Cualquier mensaje de error previo de la fila desaparece. |
| `200` | La tarea devuelta sustituye a la de la fila (vía `onUpdated`). La fila sigue en su sitio, también si el nuevo estado es «Hecho» (FR-013). |
| Error (`422`, `404`, `401`, red, `5xx`) | El último estado **confirmado por el servidor** y, debajo, el mensaje correspondiente (`FieldError`, `text-destructive text-sm`). Nunca el estado que se intentó poner (FR-012, SC-005). |
| Nuevo cambio con una petición en vuelo en la misma fila | Se muestra el nuevo valor; no se lanza otra petición en paralelo: al terminar la en curso, si el último valor elegido difiere del confirmado, se envía ese (solo el último). Al final, fila y BD coinciden con la última elección (Edge Case «varios cambios seguidos»). |
| Mismo estado que ya tenía | Nada visible cambia; si se llega a enviar, el `200` no muestra error (Edge Case). |
| Otras filas | No cambian (FR-014). |

## Mensajes

Texto exacto, generado en `lib/api.ts`:

| Caso | Mensaje |
|---|---|
| `422`, `rule: 'enum'` | Ese estado no es válido. Elige Pendiente, En curso o Hecho. |
| `422`, `rule: 'required'` | Falta rellenar el estado. |
| `404` | Esta tarea ya no existe: puede que alguien la haya borrado. Recarga la página para ver la lista al día. |
| `401` | Tu sesión ha caducado. Vuelve a iniciar sesión. |
| Sin conexión | No se pudo conectar con el servidor. Comprueba que el backend está arrancado. |
| `5xx` / otro | Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento. |

Los tres primeros son nuevos; los tres últimos ya existen y se reutilizan tal cual. Cada caso tiene un texto distinto (el de «ya no existe» no se confunde con conexión ni con estado no válido).

## Teclado (FR-015, SC-006)

`Tab` lleva a cada `<select>` en orden de fila, después del formulario de creación. Con el control enfocado, flechas o `Espacio`/`Alt+↓` + `Enter` eligen el estado. No hay ninguna parte del flujo que exija ratón.
