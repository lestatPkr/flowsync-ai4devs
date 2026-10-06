import { ApiError, updateTaskStatus } from '@/lib/api'
import type { Task, TaskStatus } from '@/lib/types'

export type TaskStatusSyncHandlers = {
  /** Cada confirmación del servidor; `settled` = no queda ninguna elección en cola. */
  onSaved: (task: Task, settled: boolean) => void
  /** El cambio no se guardó: `confirmed` es el último estado guardado. */
  onFailed: (taskId: number, confirmed: TaskStatus, error: ApiError) => void
}

/** Lo que se sabe de los cambios de estado de una tarea. */
type TaskSync = {
  confirmed: TaskStatus
  inFlight: boolean
  queued: TaskStatus | null
}

/**
 * Guarda los cambios de estado de las tareas, fuera de cualquier componente
 * para que sobrevivan a que el control que los pidió se desmonte.
 *
 * Las peticiones de una misma tarea van de una en una: lo que se elige mientras
 * hay una en vuelo se envía al terminar (solo lo último), para que pantalla y
 * BD acaben en la última elección. Si una falla, se descarta lo encolado y se
 * avisa con el último estado confirmado.
 */
export function createTaskStatusSync(
  token: string,
  handlers: TaskStatusSyncHandlers,
): { change: (task: Task, next: TaskStatus) => void } {
  const tasks = new Map<number, TaskSync>()

  const send = async (taskId: number, sync: TaskSync, status: TaskStatus) => {
    sync.inFlight = true
    let next: TaskStatus | null = status

    while (next) {
      sync.queued = null
      try {
        const updated = await updateTaskStatus(taskId, next, token)
        sync.confirmed = updated.status
        next = sync.queued !== sync.confirmed ? sync.queued : null
        handlers.onSaved(updated, next === null)
      } catch (caught) {
        sync.queued = null
        handlers.onFailed(
          taskId,
          sync.confirmed,
          caught instanceof ApiError
            ? caught
            : new ApiError('Algo ha ido mal. Inténtalo de nuevo.', 0),
        )
        break
      }
    }

    sync.inFlight = false
  }

  return {
    change(task, next) {
      let sync = tasks.get(task.id)
      if (!sync) {
        sync = { confirmed: task.status, inFlight: false, queued: null }
        tasks.set(task.id, sync)
      }

      if (sync.inFlight) {
        sync.queued = next
      } else if (next !== sync.confirmed) {
        void send(task.id, sync, next)
      }
    },
  }
}
