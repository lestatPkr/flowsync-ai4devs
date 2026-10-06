import { useEffect, useRef, useState } from 'react'
import type { Task, TaskStatus } from '@/lib/types'
import { createTaskStatusSync } from '@/lib/task-status-sync'
import { TaskStatusControl } from '@/components/tasks/task-status-control'

type TaskStatusSelectProps = {
  task: Task
  token: string
  onUpdated: (task: Task) => void
}

/**
 * Cambia el estado de la tarea desde su propia fila, sin abrirla.
 *
 * El valor elegido se ve en el acto; si el servidor no lo confirma, la fila
 * vuelve al último estado confirmado. Las peticiones de una misma fila van de
 * una en una: lo que se elige mientras hay una en vuelo se envía al terminar
 * (solo lo último), para que fila y BD acaben en la última elección.
 */
export function TaskStatusSelect({
  task,
  token,
  onUpdated,
}: TaskStatusSelectProps) {
  const [shown, setShown] = useState<TaskStatus>(task.status)
  const [error, setError] = useState<string>()
  const latestOnUpdated = useRef(onUpdated)
  useEffect(() => {
    latestOnUpdated.current = onUpdated
  }, [onUpdated])
  const [sync] = useState(() =>
    createTaskStatusSync(token, {
      onSaved: (updated) => latestOnUpdated.current(updated),
      onFailed: (_taskId, confirmed, failure) => {
        setShown(confirmed)
        setError(failure.message)
      },
    }),
  )

  const handleChange = (status: TaskStatus) => {
    setShown(status)
    setError(undefined)
    sync.change(task, status)
  }

  return (
    <TaskStatusControl
      task={task}
      value={shown}
      error={error}
      onChange={handleChange}
    />
  )
}
