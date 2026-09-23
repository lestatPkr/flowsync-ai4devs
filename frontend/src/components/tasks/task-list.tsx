import type { Task, TaskStatus } from '@/lib/types'
import { Card } from '@/components/ui/card'

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Hecho',
}

type TaskListProps = {
  tasks: Task[]
}

/** Título, responsable y estado de cada tarea, sin necesidad de abrirla. */
export function TaskList({ tasks }: TaskListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <Card className="flex-row items-center justify-between gap-4 px-4 py-3">
            <span className="min-w-0 truncate font-medium">{task.title}</span>
            <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-sm">
              <span>{task.assignee.fullName ?? 'Sin nombre'}</span>
              <span className="bg-muted rounded-full px-2 py-0.5">
                {STATUS_LABELS[task.status]}
              </span>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
