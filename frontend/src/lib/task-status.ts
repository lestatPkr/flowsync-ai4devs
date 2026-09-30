import type { TaskStatus } from '@/lib/types'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Hecho',
}

/** El `id` del botón de cada estado en el filtro de la lista, para llevarle el foco. */
export const filterButtonId = (status: TaskStatus) => `task-filter-${status}`

/**
 * Los estados de la vista por defecto de la lista: todo lo que no está hecho.
 * Espejo de `LIVE_TASK_STATUSES` del backend (app/models/task.ts).
 */
export const LIVE_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress']
