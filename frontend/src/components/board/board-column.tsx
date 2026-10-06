import { useRef, useState } from 'react'
import type { Task, TaskStatus } from '@/lib/types'
import { STATUS_LABELS } from '@/lib/task-status'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { BoardCard } from '@/components/board/board-card'

type BoardColumnProps = {
  status: TaskStatus
  tasks: Task[]
  errors: Record<number, string>
  /** La tarjeta que se está arrastrando, si hay una. */
  draggingId?: number
  /** El estado de la tarjeta que se está arrastrando, si hay una. */
  draggingFrom?: TaskStatus
  onStatusChange: (task: Task, status: TaskStatus) => void
  onDragStart: (task: Task) => void
  onDragEnd: () => void
  /** Se ha soltado aquí una tarjeta de otra columna. */
  onDrop: () => void
}

/**
 * Una columna del tablero: una región con nombre cuyo encabezado dice el
 * estado y cuántas tarjetas tiene. El recuento sale de las tarjetas que pinta,
 * así que nunca discrepa de ellas.
 *
 * La columna entera, también vacía, es el destino al soltar una tarjeta de
 * otra columna; en la suya no admite soltar.
 */
export function BoardColumn({
  status,
  tasks,
  errors,
  draggingId,
  draggingFrom,
  onStatusChange,
  onDragStart,
  onDragEnd,
  onDrop,
}: BoardColumnProps) {
  const titleId = `board-column-${status}-title`
  const count = tasks.length
  const accepts = draggingFrom !== undefined && draggingFrom !== status
  const [over, setOver] = useState(false)
  // `dragenter` y `dragleave` saltan también en cada hijo: se cuentan.
  const depth = useRef(0)

  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className={cn(
        'min-w-0 gap-3 px-4 py-4',
        accepts && over && 'bg-accent border-ring',
      )}
      onDragEnter={(event) => {
        if (!accepts) return
        event.preventDefault()
        depth.current += 1
        setOver(true)
      }}
      onDragOver={(event) => {
        if (!accepts) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDragLeave={() => {
        if (!accepts) return
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        depth.current = 0
        setOver(false)
        if (accepts) onDrop()
      }}
    >
      <h2
        id={titleId}
        className="flex items-center gap-2 text-lg font-semibold"
      >
        {STATUS_LABELS[status]}
        <span
          aria-hidden="true"
          className="rounded-full bg-secondary px-2 text-xs font-medium text-secondary-foreground"
        >
          {count}
        </span>
        <span className="sr-only">
          ({count} {count === 1 ? 'tarea' : 'tareas'})
        </span>
      </h2>
      {count === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay tareas en este estado.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <BoardCard
              key={task.id}
              task={task}
              error={errors[task.id]}
              dragging={task.id === draggingId}
              onStatusChange={(next) => onStatusChange(task, next)}
              onDragStart={() => onDragStart(task)}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}
