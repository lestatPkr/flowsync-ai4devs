import { Link } from 'react-router'
import type { Task } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { TaskStatusSelect } from '@/components/tasks/task-status-select'

type TaskListProps = {
  tasks: Task[]
  token: string
  onTaskUpdated: (task: Task) => void
}

/** Título, responsable y estado de cada tarea, sin necesidad de abrirla. */
export function TaskList({ tasks, token, onTaskUpdated }: TaskListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <Card className="flex-row items-center justify-between gap-4 px-4 py-3">
            <Link
              to={`/tasks/${task.id}`}
              id={`task-${task.id}-link`}
              className="min-w-0 truncate rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {task.title}
            </Link>
            <div className="text-muted-foreground flex shrink-0 items-center gap-3 text-sm">
              <span>{task.assignee.fullName ?? 'Sin nombre'}</span>
              <TaskStatusSelect
                task={task}
                token={token}
                onUpdated={onTaskUpdated}
              />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}
