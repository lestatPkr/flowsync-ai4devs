import { useRef, useState } from 'react'
import { ApiError, updateTaskStatus } from '@/lib/api'
import type { Task, TaskStatus } from '@/lib/types'
import { STATUS_LABELS } from '@/lib/task-status'
import { FieldError } from '@/components/field-error'
import { cn } from '@/lib/utils'

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
  const confirmed = useRef<TaskStatus>(task.status)
  const inFlight = useRef(false)
  const queued = useRef<TaskStatus | null>(null)
  const errorId = `task-${task.id}-status-error`

  const send = async (status: TaskStatus) => {
    inFlight.current = true
    let next: TaskStatus | null = status

    while (next) {
      queued.current = null
      try {
        const updated = await updateTaskStatus(task.id, next, token)
        confirmed.current = updated.status
        onUpdated(updated)
      } catch (caught) {
        queued.current = null
        setShown(confirmed.current)
        setError(
          caught instanceof ApiError
            ? caught.message
            : 'Algo ha ido mal. Inténtalo de nuevo.',
        )
        break
      }
      next = queued.current !== confirmed.current ? queued.current : null
    }

    inFlight.current = false
  }

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const status = event.target.value as TaskStatus
    setShown(status)
    setError(undefined)

    if (inFlight.current) {
      queued.current = status
    } else if (status !== confirmed.current) {
      void send(status)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Nunca `disabled`: el navegador le quitaría el foco a quien usa teclado. */}
      <select
        value={shown}
        onChange={handleChange}
        aria-label={`Estado de «${task.title}»`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-9 w-auto rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        )}
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
