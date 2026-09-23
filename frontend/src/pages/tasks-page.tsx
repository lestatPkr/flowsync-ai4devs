import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/use-auth'
import { listTasks } from '@/lib/api'
import { TaskForm } from '@/components/tasks/task-form'
import { TaskList } from '@/components/tasks/task-list'
import { EmptyTasksState } from '@/components/tasks/empty-tasks-state'
import type { Task } from '@/lib/types'

export function TasksPage() {
  const { token } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    listTasks(token)
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [token])

  // `ProtectedRoute` garantiza que aquí ya hay sesión resuelta, con token.
  if (!token) return null

  const handleCreated = (task: Task) => {
    setTasks((current) => [task, ...current])
  }

  return (
    <div className="bg-muted/40 min-h-svh p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="text-2xl font-semibold">Tareas</h1>

        <TaskForm token={token} onCreated={handleCreated} />

        {!isLoading && tasks.length === 0 && (
          <EmptyTasksState
            onCreateFirst={() => document.getElementById('title')?.focus()}
          />
        )}
        {!isLoading && tasks.length > 0 && <TaskList tasks={tasks} />}
      </div>
    </div>
  )
}
