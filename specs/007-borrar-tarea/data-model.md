# Data Model: Borrar una tarea

Fase 1 de [plan.md](./plan.md).

## Sin cambios de esquema

**Este cambio no toca el esquema.** Ninguna migración nueva, ninguna columna, ninguna tabla. `backend/database/schema.ts` no se regenera ni se edita, y `backend/app/models/task.ts` no cambia. Lo que hace el borrado es eliminar una fila existente de `tasks`.

En particular, y a propósito (FR-022, FR-023, RNF-7, R9):

- **No hay borrado lógico**: ni `deleted_at`, ni `is_deleted`, ni una tabla `deleted_tasks`.
- **No hay atribución**: ni `deleted_by`, ni tabla de auditoría, ni línea de log con el usuario.

## Entidades

### Task (existente, solo se destruye)

| Campo | Tipo (`database/schema.ts`) | Papel en este cambio |
|---|---|---|
| `id` | `number` (PK, `increments`) | Lo único que identifica la tarea a borrar. Llega como `:id`; solo se acepta en forma canónica (`/^[1-9]\d*$/`, entero seguro) ([research §2](./research.md#2-el-id-se-valida-en-forma-canónica-no-se-interpreta)). |
| `title` | `string` | No se lee en el servidor. En la interfaz se muestra en la pregunta de confirmación y en el aviso posterior. |
| `status` | `'pending' \| 'in_progress' \| 'done'` | Irrelevante: se borra igual en cualquier estado. |
| `assigneeId` | `number` (FK → `users.id`) | Irrelevante: roles planos, cualquier miembro borra cualquier tarea (FR-001, R10). |
| `dueDate` | `DateTime \| null` | Desaparece con la tarea. |
| `createdAt`, `updatedAt` | `DateTime` | Desaparecen con la tarea. |

**Relaciones**: `Task belongsTo User` (responsable). Ninguna tabla apunta a `tasks` (es una tabla hoja, `backend/database/migrations/1790152501403_create_tasks_table.ts`), así que borrar una tarea no arrastra ni deja huérfano nada. Borrar una tarea **no** borra ni modifica a su responsable ni a ninguna otra tarea (FR-015).

### Ciclo de vida

```text
            crear (E2-1)               borrar (este cambio)
  (nada) ───────────────► existe ───────────────────────► (nada)
                           │  ▲
       cambiar estado,     └──┘
       poner fecha…
```

No hay estado intermedio «borrada»: una tarea existe o no existe. Tras el borrado, cualquier lectura o escritura sobre ese id responde «no existe» (`404`), igual que un id que nunca existió (FR-014, FR-018).

### Confirmación de borrado (solo interfaz)

No es un dato: no se guarda ni viaja al servidor (spec, Key Entities; modelo de amenazas TF-1). Es estado efímero del diálogo en el navegador:

| Estado | Significado |
|---|---|
| `closed` | No hay pregunta abierta. |
| `open` (desarmada) | Recién abierta; durante 500 ms solo Escape tiene efecto ([research §9](./research.md#9-un-doble-clic-o-un-enter-de-más-no-confirman-fr-010)). |
| `open` (armada) | Cancelar, Escape, clic fuera o «Borrar definitivamente». |
| `deleting` | Petición en vuelo; nada la interrumpe. |
| `error` | Abierta con un mensaje; se puede reintentar o cancelar. |

Transiciones y salidas en el [contrato de interfaz](./contracts/delete-task-ui.md#estados-del-diálogo).

## Reglas de validación

| Regla | Dónde | Resultado |
|---|---|---|
| Hay sesión válida por `Authorization: Bearer` | `middleware.auth()` (sin cambios) | Si no: `401`, no se borra nada. |
| `:id` es un entero positivo canónico | `TasksController.destroy` | Si no: `404`, igual que inexistente. |
| Existe una tarea con ese `id` | `Task.findOrFail` | Si no: `404`. |

No hay cuerpo ni query que validar: **no hay `422`**.
