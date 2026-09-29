# Contract: el filtro por estado en la lista

Cubre la User Story 2 (FR-012 a FR-022) en el frontend. Sin dependencias nuevas, sin componentes shadcn nuevos y sin tocar `frontend/src/auth/` (valla). `TaskList`, `TaskStatusSelect`, `EmptyTasksState`, `TaskForm` y `TaskPage` no cambian.

## `lib/api.ts`

```ts
/** La lista de la vista por defecto (sin `status`) o la de un único estado. */
export function listTasks(token: string, status?: TaskStatus): Promise<Task[]>
// GET /api/v1/tasks            (sin status)
// GET /api/v1/tasks?status=…   (con status, encodeURIComponent)

/**
 * Si el espacio tiene alguna tarea, sabiendo que `emptyView` ha llegado vacía.
 * Solo hace las peticiones complementarias que necesita (research §5).
 */
export function spaceHasTasks(token: string, emptyView: TaskStatus | null): Promise<boolean>
```

- Los errores siguen saliendo como `ApiError` de `toApiError`: un filtro no válido llega con `status === 422` y `fieldErrors.status` («Ese estado no es válido. Elige Pendiente, En curso o Hecho.», traducción de `enum` que ya existe); un fallo de red con `status === 0`; la sesión caducada con `401`.
- No se añade nada a `FIELD_LABELS` ni a `translate` (ya cubren `status` y `enum`).

## `routes/tasks-layout.tsx` (nuevo) y `app-routes.tsx`

```tsx
<Route element={<ProtectedRoute />}>
  <Route element={<TasksLayout />}>            {/* nuevo */}
    <Route path="/tasks" element={<TasksPage />} />
    <Route path="/tasks/:id" element={<TaskPage />} />
  </Route>
  <Route path="/profile" element={<ProfilePage />} />
</Route>
```

- `TasksLayout`: `const [filter, setFilter] = useState<TaskStatus | null>(null)` y `<Outlet context={{ filter, setFilter }} />`. Sin marcado propio.
- `useTaskFilter()` (mismo fichero o `routes/use-task-filter.ts`): `useOutletContext<{ filter; setFilter }>()`.
- El filtro **nunca** se lee de ni se escribe en la URL, `history.state`, `localStorage` ni `sessionStorage` ([research §7](../research.md#7-dónde-vive-el-filtro-un-layout-de-ruta-sobre-tasks-y-tasksid)).

| Situación | Filtro al llegar a `/tasks` |
|---|---|
| abrir una tarea y volver con «Volver a la lista» (o el botón atrás) | el mismo (FR-013) |
| recargar, cerrar sesión y entrar, abrir otro día, ir a `/profile` y volver | `null` → vista por defecto (FR-012) |
| llegar por `/tasks?status=done` o `/tasks?status=archivada` | `null`, sin aviso (US2-12) |

## `components/tasks/task-status-filter.tsx` (nuevo)

```tsx
type TaskStatusFilterProps = {
  value: TaskStatus | null
  onChange: (value: TaskStatus | null) => void
}
```

- `<div role="group" aria-label="Filtrar por estado">` con un `Button` por estado en el orden de `STATUS_LABELS` («Pendiente», «En curso», «Hecho»): aplicado → `variant="default"` + `aria-pressed="true"`; resto → `variant="outline"` + `aria-pressed="false"`. `size="sm"`.
- «Quitar filtro»: `Button variant="ghost" size="sm"`, solo si `value !== null`; llama a `onChange(null)`.
- Pulsar el estado ya aplicado no hace nada; pulsar otro lo sustituye (CA-16).
- Línea de estado debajo, `<p aria-live="polite" className="text-muted-foreground text-sm">`:
  - sin filtro: «Mostrando pendientes y en curso. Las tareas hechas no se muestran: filtra por «Hecho» para consultarlas.»
  - con filtro: «Filtrando por «{STATUS_LABELS[value]}»: solo se muestran las tareas en ese estado.»
- Nunca `disabled` (el repo lo evita para no quitar el foco a quien usa teclado).

## `pages/tasks-page.tsx`

Orden en pantalla: título → `TaskForm` → `TaskStatusFilter` → zona de la lista.

### Carga

- `useEffect` con dependencias `[token, filter, attempt]`: `listTasks(token, filter ?? undefined)`; si llega vacía, `spaceHasTasks(token, filter)`. Limpieza con `ignore = true`: solo se pinta la respuesta del último filtro ([research §11](../research.md#11-la-página-actual-no-distingue-un-fallo-de-carga-de-un-espacio-vacío)).
- Estado con clave = filtro (`'default'` sin filtro); mientras la clave no coincide, la zona de la lista no pinta nada.

### Zona de la lista

| Estado | Condición | Contenido |
|---|---|---|
| lista | `tasks.length > 0` | `<TaskList … />` |
| (a) estado sin tareas | filtro, `[]`, `spaceHasTasks` | `Card` + `CardHeader`: `CardTitle` «No hay tareas en este estado» · `CardDescription` «Ahora mismo ninguna tarea del equipo está en «{estado}». Elige otro estado o quita el filtro para volver a la vista por defecto.» |
| (b) espacio sin tareas | `[]`, `!spaceHasTasks` (con o sin filtro) | `<EmptyTasksState />` sin cambios |
| (c) nada vivo | sin filtro, `[]`, `spaceHasTasks` | `Card`: «No hay nada pendiente ni en curso» · «Todas las tareas del equipo están hechas. Para consultarlas, filtra por [Hecho].» — «Hecho» es un `<button type="button">` con las clases del de `EmptyTasksState` que hace `setFilter('done')` |
| filtro no válido | `ApiError` `422` con `fieldErrors.status` | `Alert variant="destructive"`: `AlertTitle` «Ese filtro no es válido» · `AlertDescription` con el mensaje + `Button variant="outline" size="sm"` «Volver a la vista por defecto» → `setFilter(null)` |
| fallo de carga | cualquier otro error | `Alert variant="destructive"`: «No se ha podido cargar la lista» · mensaje de `ApiError` · «Reintentar» (`attempt + 1`), salvo `401` |

Los mensajes de (a), (b), (c), filtro no válido y fallo de carga son mutuamente excluyentes (FR-017, FR-018, FR-019, SC-010).

### Cambios locales

- `handleUpdated(task)` (de `TaskStatusSelect`, solo con estados confirmados): si `task.status` encaja en la vista (sin filtro: `pending`/`in_progress`; con filtro: `=== filter`), sustituye la fila o la inserta en su sitio (`createdAt` desc, `id` desc); si no, la quita. `spaceHasTasks = true`. Si la fila quitada contenía `document.activeElement`, el foco va al enlace de la fila siguiente, o de la anterior, o al `CardTitle` del vacío (con `tabIndex={-1}`) si no queda ninguna (FR-021).
- `handleCreated(task)`: sin filtro o `filter === 'pending'` → se antepone; con `in_progress` o `done` → `setFilter(null)` (recarga la vista por defecto, que la incluye; FR-020). `spaceHasTasks = true`.
- El efecto existente de `focusTaskId` (volver desde una tarea) se mantiene y funciona igual con el filtro conservado.

## Teclado y accesibilidad (FR-021, SC-008)

| Acción | Interacciones |
|---|---|
| aplicar un estado | Tab hasta el botón + Enter/Espacio (1 clic con ratón) |
| cambiar a otro | Tab + Enter (1 clic) |
| quitar | Tab hasta «Quitar filtro» + Enter (1 clic) |

El filtro aplicado se identifica sin color: `aria-pressed`, la variante del botón y la línea de estado que lo nombra (anunciada por `aria-live`). Focus ring de `Button` sin cambios (R-8).
