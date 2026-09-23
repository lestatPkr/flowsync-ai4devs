# Data Model: Crear tarea con solo el título

## Entidad: Task

Representa la unidad de trabajo del espacio compartido (ver "Key Entities" en `spec.md`). Esta historia solo cubre su creación y su lectura en lista; editar, reasignar, cambiar de estado o poner fecha de vencimiento quedan fuera de alcance y no añaden campos aquí (se documentan como extensión futura).

| Campo | Tipo (Lucid/SQLite) | Reglas | Origen del requisito |
|---|---|---|---|
| `id` | `increments` (PK) | Autogenerado | — |
| `title` | `string`, `NOT NULL` | Recortado de espacios al principio/final; longitud entre 1 y 200 caracteres tras el recorte; nunca vacío ni solo espacios | FR-001, FR-005, FR-006, FR-007 |
| `status` | `string`, `NOT NULL`, default `'pending'` | Uno de exactamente tres valores: `pending`, `in_progress`, `done` (enum `TaskStatus`); no hay forma de crear, renombrar ni eliminar valores | FR-003, FR-004 |
| `assignee_id` | `integer unsigned`, `NOT NULL`, FK → `users.id`, `onDelete('CASCADE')` | Fijado por el servidor a quien crea la tarea; no se acepta como input en la creación | FR-002 |
| `created_at` | `timestamp`, `NOT NULL` (autoCreate) | — | — |
| `updated_at` | `timestamp` nullable (autoCreate + autoUpdate) | — | — |

### Relaciones

- `Task.assignee` — `belongsTo(() => User, { foreignKey: 'assigneeId' })`. Un `User` puede tener muchas `Task` asignadas (`hasMany` inverso no se añade al modelo `User` en esta historia porque nada lo consume todavía; se añade cuando una historia futura lo necesite, para no anticipar uso).

### Estados (`TaskStatus`)

```
pending      → "Pendiente"  (estado inicial de toda tarea nueva)
in_progress  → "En curso"
done         → "Hecho"
```

Catálogo cerrado: no existe endpoint, migración de datos de catálogo, ni UI para añadir, renombrar o borrar un estado (FR-004). El mapeo a las etiquetas en castellano vive en el transformer/frontend, no en la base de datos (ver `research.md`, sección 1).

### Reglas de validación (capa de entrada, antes de tocar el modelo)

- `title`: `vine.string().trim().minLength(1).maxLength(200)`.
  - Vacío o solo espacios → error de validación en el campo `title` (FR-005).
  - Espacios al principio/final → recortados antes de guardar (FR-006).
  - Más de 200 caracteres tras el recorte → error de validación en el campo `title`, la tarea no se crea (FR-007).
- `status` y `assignee_id` no forman parte del payload de creación: el validador de `store` solo declara `title`. Cualquier otro campo que llegue en el body se ignora (VineJS por defecto no lo incluye en el resultado validado), cumpliendo FR-001 ("no se solicita ni sugiere ningún otro dato").

### Serialización (transformer → frontend)

`TaskTransformer` expone, envuelto por `serialize()` como el resto de la API:

```json
{
  "id": 12,
  "title": "Revisar el PR de auth",
  "status": "pending",
  "assignee": {
    "id": 3,
    "fullName": "Oscar Torres",
    "initials": "OT"
  },
  "createdAt": "2026-09-23T10:15:00.000Z"
}
```

`assignee` reutiliza los mismos campos que ya expone `UserTransformer` (`id`, `fullName`, `initials`) — lo mínimo que la lista necesita para mostrar el responsable (FR-009) sin duplicar la forma completa de `User`.

## Migración

Nueva tabla `tasks`, migración independiente (`node ace make:migration create_tasks_table`), sin tocar ninguna migración ni tabla existente. Tras `node ace migration:run`, `database/schema.ts` se regenera automáticamente con la clase `TaskSchema` — no se edita a mano (BOUNDARIES.md).
