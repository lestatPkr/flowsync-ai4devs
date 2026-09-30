import { useOutletContext } from 'react-router'
import type { TaskStatus } from '@/lib/types'

/** El filtro por estado de la lista: `null` es la vista por defecto. */
export type TaskFilterContext = {
  filter: TaskStatus | null
  setFilter: (value: TaskStatus | null) => void
}

/** El filtro que guarda `TasksLayout` para las pantallas de la lista y de la tarea. */
export function useTaskFilter() {
  return useOutletContext<TaskFilterContext>()
}
