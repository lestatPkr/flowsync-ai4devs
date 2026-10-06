import type { Task, TaskStatus } from '@/lib/types'
import { STATUS_LABELS } from '@/lib/task-status'
import { FieldError } from '@/components/field-error'
import { cn } from '@/lib/utils'

type TaskStatusControlProps = {
  task: Pick<Task, 'id' | 'title'>
  value: TaskStatus
  error?: string
  onChange: (status: TaskStatus) => void
}

/**
 * El control de estado de una tarea, el mismo en la lista y en el tablero.
 * Solo pinta: qué se muestra, el error y qué hacer al cambiar lo decide quien
 * lo usa.
 */
export function TaskStatusControl({
  task,
  value,
  error,
  onChange,
}: TaskStatusControlProps) {
  const errorId = `task-${task.id}-status-error`

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Nunca `disabled`: el navegador le quitaría el foco a quien usa teclado. */}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as TaskStatus)}
        aria-label={`Estado de «${task.title}»`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'h-9 w-auto rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        )}
      >
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <option key={status} value={status}>
            {label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  )
}
