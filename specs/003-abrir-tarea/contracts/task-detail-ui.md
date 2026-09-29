# Contract: abrir una tarea y volver a la lista

Cubre FR-001 a FR-014 en el lado del cliente. Interfaz entre las piezas del frontend y lo que ve el usuario. Decisiones y alternativas en [research.md §7-§12](../research.md#7-ruta-y-carga-en-el-frontend).

## `lib/api.ts`

```ts
export function getTask(id: string, token: string): Promise<Task>
```

- `GET /api/v1/tasks/${encodeURIComponent(id)}` con `Authorization: Bearer <token>`; resuelve con la tarea de `data` ([task-detail-api.md](./task-detail-api.md#respuesta--éxito-200)).
- Rechaza siempre con `ApiError`: `status` HTTP (o `0` sin conexión) y `message` ya en castellano. Con `404`, `status: 404` y el mensaje de tarea inexistente.
- El comentario de `updateTaskStatus()` sobre «solo este endpoint responde 404» se corrige.

## `lib/task-status.ts` (nuevo)

```ts
export const STATUS_LABELS: Record<TaskStatus, string>
// { pending: 'Pendiente', in_progress: 'En curso', done: 'Hecho' }
```

Movido tal cual desde `task-status-select.tsx`, que pasa a importarlo. Lo usan la fila y la vista.

## Rutas (`routes/app-routes.tsx`)

| Ruta | Guard | Elemento |
|---|---|---|
| `/tasks` | `ProtectedRoute` | `TasksPage` (sin cambios de ruta) |
| `/tasks/:id` (nueva) | `ProtectedRoute` | `TaskPage` |

Sin sesión, `ProtectedRoute` redirige a `/login` como en cualquier otra pantalla protegida; `TaskPage` no llega a montarse ni a pedir nada (FR-008).

## Componentes

| Pieza | Cambio | Responsabilidad |
|---|---|---|
| `components/tasks/task-list.tsx` | El título de cada fila es `<Link to="/tasks/{id}" id="task-{id}-link">` | Abrir la tarea en 1 interacción. Solo el título es enlace: responsable y `<TaskStatusSelect>` siguen en la fila, fuera del enlace (FR-013). |
| `pages/task-page.tsx` (nuevo) | — | Carga la tarea del `:id`, pinta la vista o uno de los dos avisos. Solo consulta. |
| `pages/tasks-page.tsx` | Lee `location.state.focusTaskId` | Tras cargar la lista, enfoca `#task-{focusTaskId}-link` si existe (FR-004). |
| `components/tasks/task-status-select.tsx` | Importa `STATUS_LABELS` de `lib/task-status.ts` | Sin cambio de comportamiento. |

## El enlace de la fila

- Mismo aspecto que el título actual (`font-medium`, recortado con `truncate`) + subrayado al pasar el ratón y el anillo de foco del repo (`focus-visible:ring-[3px] focus-visible:ring-ring/50`).
- Nombre accesible: el título completo de la tarea.
- `Tab`: formulario de creación → enlace de la fila 1 → select de la fila 1 → enlace de la fila 2 → …

## La página: estados

La vista con datos solo aparece con una tarea recibida entera del servidor para el `:id` actual. Una respuesta que llega para otro `:id` se descarta.

| Estado | Cuándo | Lo que se ve |
|---|---|---|
| Cargando | Al montar o al cambiar `:id` | `FullScreenLoader` («Cargando…» para lector de pantalla). Ningún título, responsable, estado ni fecha. |
| Tarea | `200` | Enlace «← Volver a la lista» arriba y un `Card` con: `<h1>` con el título completo (sin recortar, parte palabras largas), y un `<dl>` con **Responsable** (`fullName ?? 'Sin nombre'`), **Estado** (`STATUS_LABELS`) y **Creada el** (fecha). Ningún control que modifique la tarea (FR-006). |
| Ya no existe | `ApiError.status === 404` | Enlace «← Volver a la lista» arriba y un `Alert` con título «Esta tarea ya no existe» y texto «Puede que alguien la haya borrado.». Ningún dato de tarea (FR-009, FR-010). |
| No se ha podido cargar | Cualquier otro `ApiError` | Enlace «← Volver a la lista» arriba y un `Alert variant="destructive"` con título «No se ha podido cargar la tarea», el `message` del error como texto y un botón «Reintentar» (salvo con `401`). Nunca dice que la tarea no existe (FR-011). |

«Reintentar» vuelve al estado *Cargando* y repite `getTask`.

## Enlace «Volver a la lista»

| Desde | Destino | `state` |
|---|---|---|
| Vista de la tarea | `/tasks` | `{ focusTaskId: task.id }` |
| Aviso «ya no existe» o «no se ha podido cargar» | `/tasks` | ninguno |

Es un `Link` de react-router con el aspecto de `Button variant="link"` (vía `asChild`) y `ArrowLeftIcon`, siempre en el mismo sitio (arriba, antes del `Card` o del `Alert`). Es el **primer** elemento enfocable de la página en los tres estados con contenido.

## Fecha

`Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' })` sobre `createdAt`, en la zona del navegador: «29 de septiembre de 2026, 10:15».

## Mensajes

| Caso | Título | Texto |
|---|---|---|
| `404` | Esta tarea ya no existe | Puede que alguien la haya borrado. |
| `401` | No se ha podido cargar la tarea | Tu sesión ha caducado. Vuelve a iniciar sesión. |
| Sin conexión | No se ha podido cargar la tarea | No se pudo conectar con el servidor. Comprueba que el backend está arrancado. |
| `5xx` / otro | No se ha podido cargar la tarea | Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento. |

El texto del `404` lo genera `getTask()`; los tres últimos ya existen en `lib/api.ts` y se reutilizan. Los títulos los pone la página según el `status`.

## Teclado (FR-004, SC-005)

1. En la lista, `Tab` hasta el enlace de una tarea y `Enter`: se abre.
2. En la página, el primer `Tab` alcanza «Volver a la lista»; `Enter`: vuelve.
3. De vuelta en la lista, el foco está en el enlace de la tarea abierta; `Tab` sigue a su select y a la fila siguiente.
4. En el aviso «ya no existe», el primer `Tab` alcanza «Volver a la lista».
