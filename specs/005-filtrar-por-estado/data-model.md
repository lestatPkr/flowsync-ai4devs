# Data Model: Filtrar la lista por estado

**Nada cambia en el esquema.** No hay migración, `backend/database/schema.ts` no se regenera por este cambio y `Task` no gana ni pierde columnas. Filtrar se apoya en `tasks.status`, que existe desde E2-1 (spec, Assumptions: «sin nada nuevo que almacenar»).

## Tarea (existente, sin cambios)

| Campo | Tipo | Relevancia aquí |
|---|---|---|
| `id` | integer | desempate del orden (`id desc`) |
| `title` | string | — |
| `status` | `'pending' \| 'in_progress' \| 'done'` (`TASK_STATUSES`) | **única** dimensión de filtrado (FR-011) |
| `assigneeId` → `assignee` | FK a `users` | se sigue precargando; no filtra |
| `createdAt` | datetime | orden de la lista (`desc`), sin cambios |
| `dueDate` | date \| null | no filtra, no se muestra en la lista |

La fila de la lista sigue siendo `TaskTransformer`: `{ id, title, status, createdAt, assignee: { id, fullName, initials } }`, sin cambios.

## Conceptos derivados (sin persistencia)

### Vista por defecto

- Definición: las tareas con `status ∈ LIVE_TASK_STATUSES = ['pending', 'in_progress']`.
- Nueva constante en `backend/app/models/task.ts`, junto a `TASK_STATUSES` ([research §3](./research.md#3-la-vista-por-defecto-wherein-sobre-los-estados-vivos-en-el-mismo-query)).
- Es la **ausencia** de filtro: no tiene valor propio en la query.

### Filtro por estado

- Valor: exactamente uno de `TASK_STATUSES`, o ninguno.
- Regla de validación (backend, `listTasksValidator`): `status: vine.enum(TASK_STATUSES).optional()` sobre `request.qs()`. Cualquier otra cosa (vacío, desconocido, otra caja, array) → `422` ([research §2](./research.md#2-validación-vineenumtask_statusesoptional-sobre-requestqs)).
- Vida (frontend): `useState<TaskStatus | null>` en `TasksLayout`, en memoria; nace `null` en cada visita a la lista ([research §7](./research.md#7-dónde-vive-el-filtro-un-layout-de-ruta-sobre-tasks-y-tasksid)).

### Partición que permite distinguir los vacíos

```text
tareas del espacio = vista por defecto (pending ∪ in_progress)  ⊔  «Hecho» (done)
espacio vacío      ⇔  GET /tasks = []  ∧  GET /tasks?status=done = []
```

Es lo que hace verdad FR-008 / US1-11 sin tocar la respuesta ([research §5](./research.md#5-saber-si-el-espacio-está-vacío-fr-008-us1-11-sin-cambiar-la-forma-de-la-respuesta)).

## Transiciones que mueven una tarea entre vistas

No hay reglas nuevas de transición: toda transición de estado sigue siendo válida (`specs/002-cambiar-estado/`). Lo que cambia es **en qué vista aparece** la tarea tras cada una:

| Transición | Sale de | Entra en |
|---|---|---|
| `pending` ↔ `in_progress` | filtro del estado de origen | filtro del destino; sigue en la vista por defecto |
| `pending`/`in_progress` → `done` | vista por defecto y filtro de origen | filtro «Hecho» |
| `done` → `pending`/`in_progress` | filtro «Hecho» | vista por defecto y filtro del destino |
| crear (nace `pending`) | — | vista por defecto y filtro «Pendiente» |

Esto sustituye, para la vista por defecto, `specs/002-cambiar-estado/` FR-013 (la tarea hecha seguía en la lista) y el supuesto equivalente de `specs/004-fecha-vencimiento/`; esos documentos no se editan, la sustitución queda registrada en la spec de este cambio.

## Estado de la lista en la interfaz (frontend, sin persistencia)

```ts
type ListState =
  | { key: FilterKey; kind: 'loaded'; tasks: Task[]; spaceHasTasks: boolean }
  | { key: FilterKey; kind: 'invalid-filter'; message: string }
  | { key: FilterKey; kind: 'error'; error: ApiError }
// FilterKey = TaskStatus | 'default'; sin estado para la clave actual → «cargando»
```

De `loaded` se deriva qué se pinta ([research §10](./research.md#10-estados-de-la-lista-y-textos)): `tasks.length > 0` → lista; si no, `!spaceHasTasks` → (b), con filtro → (a), sin filtro → (c).
