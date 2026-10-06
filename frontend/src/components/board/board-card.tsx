import { useRef } from 'react'
import { Link } from 'react-router'
import type { Task, TaskStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { TaskStatusControl } from '@/components/tasks/task-status-control'

type BoardCardProps = {
  task: Task
  error?: string
  dragging: boolean
  onStatusChange: (status: TaskStatus) => void
  onDragStart: () => void
  onDragEnd: () => void
}

/**
 * Una tarea en el tablero: título (que la abre), responsable y su control de
 * estado. Nada más: ni prioridad, ni foto, ni fechas.
 *
 * Se arrastra con el ratón como atajo; el camino garantizado, también con
 * teclado, es su control de estado. Por eso no lleva ARIA de arrastre ni es
 * enfocable: no añade paradas de tabulación vacías.
 */
export function BoardCard({
  task,
  error,
  dragging,
  onStatusChange,
  onDragStart,
  onDragEnd,
}: BoardCardProps) {
  // Dónde se pulsó: un arrastre que empieza en el control de estado no mueve la tarjeta.
  const pressedOn = useRef<EventTarget | null>(null)

  return (
    <li
      id={`board-task-${task.id}`}
      draggable
      data-dragging={dragging}
      className="data-[dragging=true]:opacity-50"
      onMouseDown={(event) => {
        pressedOn.current = event.target
      }}
      onDragStart={(event) => {
        const target = pressedOn.current
        if (target instanceof Element && target.closest('select')) {
          event.preventDefault()
          return
        }
        event.dataTransfer.effectAllowed = 'move'
        // Sin `setData` algunos navegadores no empiezan el arrastre.
        event.dataTransfer.setData('text/plain', String(task.id))
        onDragStart()
      }}
      onDragEnd={onDragEnd}
    >
      <Card className="gap-2 px-4 py-3">
        <Link
          id={`board-task-${task.id}-link`}
          to={`/tasks/${task.id}`}
          state={{ from: 'board' }}
          draggable={false}
          className="max-w-full self-start rounded-sm font-medium wrap-break-word underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {task.title}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <span className="text-muted-foreground text-sm">
            {task.assignee.fullName ?? 'Sin nombre'}
          </span>
          <TaskStatusControl
            task={task}
            value={task.status}
            error={error}
            onChange={onStatusChange}
          />
        </div>
      </Card>
    </li>
  )
}
