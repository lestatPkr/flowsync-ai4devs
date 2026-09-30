import { useState } from 'react'
import { Outlet } from 'react-router'
import type { TaskStatus } from '@/lib/types'
import type { TaskFilterContext } from '@/routes/use-task-filter'

/**
 * Guarda el filtro de la lista mientras se va y se vuelve de una tarea, y solo
 * entonces: vive en memoria, nunca en la URL ni en el almacenamiento, así que
 * recargar, cerrar sesión o salir a otra pantalla lo devuelven a la vista por
 * defecto.
 */
export function TasksLayout() {
  const [filter, setFilter] = useState<TaskStatus | null>(null)

  return <Outlet context={{ filter, setFilter } satisfies TaskFilterContext} />
}
