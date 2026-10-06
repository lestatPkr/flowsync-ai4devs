# Data Model: Tablero de tareas por estado

## Sin cambios de datos

Este cambio **no toca ningún dato persistido**: ni migraciones, ni columnas, ni `backend/database/schema.ts`, ni modelos, ni transformers, ni reglas de validación. El tablero es otra forma de **pintar** las mismas tareas que ya devuelve `GET /api/v1/tasks?status=<estado>` y de **cambiar** el único dato que ya se podía cambiar desde la lista, el estado, con `PATCH /api/v1/tasks/:id/status`. Lo único nuevo es estado de interfaz, en memoria del navegador, que se pierde al recargar.

## Entidades que el tablero lee

### Tarea (`Task`, `frontend/src/lib/types.ts`)

Espejo de `TaskTransformer` del backend, sin cambios. Es lo que devuelven las tres lecturas del tablero y la respuesta del `PATCH`.

| Campo | Tipo | Uso en el tablero |
|---|---|---|
| `id` | `number` | Clave de la tarjeta, destino del enlace (`/tasks/:id`), ids del DOM (`board-task-{id}`) y clave de la sincronización |
| `title` | `string` | Texto del enlace de la tarjeta y del `aria-label` de su control de estado |
| `status` | `'pending' \| 'in_progress' \| 'done'` | Columna en la que va la tarjeta y valor de su control de estado |
| `assignee.fullName` | `string \| null` | Nombre del responsable; `null` → «Sin nombre» (como la lista) |
| `assignee.id`, `assignee.initials` | | No se pintan (la spec excluye avatares) |
| `createdAt` | `string` ISO | No se pinta; ordena las tarjetas dentro de su columna (`byListOrder`) |

`TaskDetail` (`dueDate`, `isOverdue`) **no** se usa: la lista no los trae y la tarjeta no debe enseñar ni fecha ni marca de vencida (FR-004, RF-15).

### Estado (`TaskStatus`)

Catálogo cerrado de tres valores; sus etiquetas, en `STATUS_LABELS` (`lib/task-status.ts`): `pending` → «Pendiente», `in_progress` → «En curso», `done` → «Hecho». El orden de las claves de `STATUS_LABELS` es el orden de las columnas y de las opciones del control. Cualquier transición es válida (`specs/002-cambiar-estado/`).

## De dónde sale cada cosa que pinta la tarjeta

| En pantalla | Origen | Nota |
|---|---|---|
| Título (enlace) | `task.title` de la respuesta de `GET /api/v1/tasks?status=…` | Enlaza a `/tasks/{task.id}` con `state={{ from: 'board' }}` |
| Responsable | `task.assignee.fullName ?? 'Sin nombre'` | `text-muted-foreground`, como en la lista |
| Estado | valor del `TaskStatusControl` = `task.status` **mostrado** (optimista) | La columna lo refuerza; no hay etiqueta de estado aparte (supuesto de la spec) |
| Mensaje de cambio no guardado | `errors[task.id]` del estado de la página: «No se ha guardado el cambio.» + `ApiError.message` de `lib/api.ts` | Solo tras un fallo; se borra en el siguiente cambio de esa tarea |
| Columna en la que está | `task.status` mostrado | Durante un cambio en vuelo, el estado elegido; tras un fallo, el último confirmado |

Lo que pinta cada columna:

| En pantalla | Origen |
|---|---|
| Nombre | `STATUS_LABELS[estado]` |
| Recuento | número de tareas cargadas cuyo `status` mostrado es ese estado (derivado, nunca guardado aparte) |
| Tarjetas | esas tareas, ordenadas con `byListOrder` |
| Mensaje de vacía | cuando ese número es 0 |

## Estado de interfaz (nuevo, solo en memoria)

### Estado de la página del tablero (`pages/board-page.tsx`)

```ts
type BoardState =
  | { key: number; kind: 'loaded'; tasks: Task[]; errors: Record<number, string> }
  | { key: number; kind: 'error'; error: ApiError }
// `key` = intento de carga («Reintentar» lo incrementa). Sin estado o con otra
// `key`, la página está cargando (mismo patrón que `TasksPage`).
```

- `tasks` es la unión sin duplicados de las tres respuestas (`listTasksByStatus`), con `status` = **estado mostrado**. Las columnas se derivan filtrando por `status`.
- `errors` guarda el mensaje del último cambio fallido por tarea.
- «Espacio sin tareas» (FR-021) = `kind === 'loaded' && tasks.length === 0`; no hace falta otra lectura.
- Además, en la página: `draggingId: number | null` (tarjeta que se está arrastrando), el `ref` del id a enfocar tras pintar (§5 de research) y el texto del anuncio de estado (`role="status"`).

### Sincronización de estados (`lib/task-status-sync.ts`)

Una instancia por página del tablero (y una por `TaskStatusSelect` en la lista). Por cada tarea que se ha intentado cambiar:

```ts
type Entry = {
  confirmed: TaskStatus        // último estado que el servidor ha confirmado
  inFlight: boolean            // hay un PATCH de esta tarea sin respuesta
  queued: TaskStatus | null    // última elección hecha mientras había uno en vuelo
}
```

`change(task, next)`: si es la primera vez para esa tarea, `confirmed = task.status` (en ese momento mostrado y confirmado coinciden). Avisa con `onSaved(task, settled)` y `onFailed(taskId, confirmed, error)`.

## Transiciones de una tarjeta

```text
                 elegir otro estado (select) / soltar en otra columna
   [quieta en E] ───────────────────────────────────────────────▶ [en vuelo hacia N]
        ▲                  · la tarjeta pasa a la columna N en el acto       │
        │                  · recuentos al día; anuncio «… está en N»          │
        │                  · foco a su control, ya en N                       │
        │                                                                     │
        │   confirmado y nada en cola (onSaved, settled)                      │
        ├─────────────────────────────────────────────────────────────────────┤
        │   · la tarea se sustituye por la del servidor (estado N)            │
        │                                                                     │
        │   otra elección M mientras está en vuelo                            │
        │   · la tarjeta pasa a M en el acto; M queda en cola                 │
        │   · al confirmarse N, sale M (solo la última)                       │
        │                                                                     │
        │   fallo (onFailed)                                                  │
        └─────────────────────────────────────────────────────────────────────┘
            · la tarjeta vuelve a la columna del último estado confirmado
            · recuentos vuelven; se descarta la cola
            · mensaje en la tarjeta + anuncio; foco a su control si estaba en ella
```

Soltar en la misma columna o fuera de cualquier columna no es una transición: no llama a `change` (FR-017). Elegir en el select el mismo estado que ya está confirmado, sin nada en vuelo, tampoco envía nada (como hoy en la lista).

## Invariantes

- Cada tarea cargada aparece en **una** columna, la de su `status` mostrado (FR-002); el recuento de cada columna es el número de sus tarjetas (FR-003).
- Cuando no hay nada en vuelo para una tarea, su `status` mostrado es el último confirmado por el servidor (FR-015, SC-005).
- Mover una tarjeta solo cambia su `status`; `title` y `assignee` llegan del servidor sin tocar (FR-018).
