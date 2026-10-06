import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { ListIcon, Loader2Icon } from 'lucide-react'
import { useAuth } from '@/auth/use-auth'
import { ApiError, listTasksByStatus } from '@/lib/api'
import { byListOrder, STATUS_LABELS } from '@/lib/task-status'
import { createTaskStatusSync } from '@/lib/task-status-sync'
import type { Task, TaskStatus } from '@/lib/types'
import { BoardColumn } from '@/components/board/board-column'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Lo que se sabe del tablero. `attempt` es el intento de carga del que viene:
 * si no es el actual, el tablero está cargando.
 */
type BoardState =
  | { attempt: number; kind: 'loaded'; tasks: Task[] }
  | { attempt: number; kind: 'error'; error: ApiError }

const COLUMNS = Object.keys(STATUS_LABELS) as TaskStatus[]

/** La tarea `id` con otros datos, en el sitio que le toca por el orden de la lista. */
function replaceTask(tasks: Task[], id: number, change: Partial<Task>) {
  return tasks
    .map((task) => (task.id === id ? { ...task, ...change } : task))
    .sort(byListOrder)
}

/**
 * Las tareas del equipo en tres columnas, una por estado. Una tarea cambia de
 * columna eligiendo otro estado en su control o arrastrándola: se ve en el
 * acto y, si no se guarda, vuelve a la columna de su último estado guardado.
 */
export function BoardPage() {
  const { token } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<BoardState>()
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [announcement, setAnnouncement] = useState('')
  const [draggingId, setDraggingId] = useState<number>()
  // La tarjeta cuyo control hay que enfocar tras pintarla en su nueva columna.
  const focusAfterMove = useRef<number | undefined>(undefined)
  // Una sola sincronización para todo el tablero: sobrevive a que la tarjeta
  // se desmonte al cambiar de columna, y control y arrastre comparten su cola.
  const sync = useRef<ReturnType<typeof createTaskStatusSync>>(undefined)
  const titles = useRef(new Map<number, string>())
  const location = useLocation()
  // Al volver de una tarea abierta desde el tablero, el foco vuelve a su título.
  const returnFocusTo = useRef(
    (location.state as { focusTaskId?: number } | null)?.focusTaskId,
  )

  useEffect(() => {
    if (!token) return
    let stale = false

    listTasksByStatus(token)
      .then((columns) => {
        if (stale) return
        setState({
          attempt,
          kind: 'loaded',
          tasks: COLUMNS.flatMap((status) => columns[status]),
        })
      })
      .catch((caught: unknown) => {
        if (stale) return
        setState({
          attempt,
          kind: 'error',
          error:
            caught instanceof ApiError
              ? caught
              : new ApiError(
                  'Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.',
                  0,
                ),
        })
      })

    return () => {
      stale = true
    }
  }, [token, attempt])

  const isLoaded = state?.attempt === attempt && state.kind === 'loaded'

  useEffect(() => {
    if (state?.kind !== 'loaded') return
    for (const task of state.tasks) titles.current.set(task.id, task.title)
  }, [state])

  // El foco sigue a la tarjeta movida, a su control, ya en su columna.
  useEffect(() => {
    const taskId = focusAfterMove.current
    if (taskId === undefined) return
    focusAfterMove.current = undefined
    document
      .querySelector<HTMLSelectElement>(`#board-task-${taskId} select`)
      ?.focus()
  }, [state])

  useEffect(() => {
    if (!isLoaded || returnFocusTo.current === undefined) return
    document.getElementById(`board-task-${returnFocusTo.current}-link`)?.focus()
    returnFocusTo.current = undefined
  }, [isLoaded])

  // `ProtectedRoute` garantiza que aquí ya hay sesión resuelta, con token.
  if (!token) return null

  const updateTasks = (update: (tasks: Task[]) => Task[]) =>
    setState((current) =>
      current?.kind === 'loaded'
        ? { ...current, tasks: update(current.tasks) }
        : current,
    )

  const startSync = () =>
    createTaskStatusSync(token, {
      onSaved: (saved, settled) => {
        // Con otra elección en cola, la tarjeta ya enseña esa: no se toca.
        if (settled) updateTasks((tasks) => replaceTask(tasks, saved.id, saved))
      },
      onFailed: (taskId, confirmed, error) => {
        const card = document.getElementById(`board-task-${taskId}`)
        const focused = document.activeElement
        // Si la persona ya está en otra parte, el foco no se le roba.
        if (!focused || focused === document.body || card?.contains(focused)) {
          focusAfterMove.current = taskId
        }
        updateTasks((tasks) =>
          replaceTask(tasks, taskId, { status: confirmed }),
        )
        setErrors((current) => ({
          ...current,
          [taskId]: `No se ha guardado el cambio. ${error.message}`,
        }))
        setAnnouncement(
          `No se ha guardado el cambio: «${titles.current.get(taskId)}» vuelve a «${STATUS_LABELS[confirmed]}».`,
        )
      },
    })

  /** La única puerta para cambiar de columna, la usen el control o el arrastre. */
  const move = (task: Task, next: TaskStatus) => {
    if (next === task.status) return
    sync.current ??= startSync()
    focusAfterMove.current = task.id
    updateTasks((tasks) => replaceTask(tasks, task.id, { status: next }))
    setErrors(({ [task.id]: _cleared, ...rest }) => rest)
    setAnnouncement(`«${task.title}» está ahora en «${STATUS_LABELS[next]}».`)
    sync.current.change(task, next)
  }

  const renderBoard = () => {
    if (!state || state.attempt !== attempt) {
      return (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-2 text-sm"
        >
          <Loader2Icon aria-hidden="true" className="size-4 animate-spin" />
          Cargando el tablero…
        </p>
      )
    }

    if (state.kind === 'error') {
      return (
        <Alert variant="destructive">
          <AlertTitle>No se ha podido cargar el tablero</AlertTitle>
          <AlertDescription>
            <p>{state.error.message}</p>
            {/* Con la sesión caducada, repetir no sirve de nada. */}
            {state.error.status !== 401 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => setAttempt((current) => current + 1)}
              >
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )
    }

    const dragged = state.tasks.find((task) => task.id === draggingId)

    const columns = (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start">
        {COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            tasks={state.tasks.filter((task) => task.status === status)}
            errors={errors}
            draggingId={dragged?.id}
            draggingFrom={dragged?.status}
            onStatusChange={move}
            onDragStart={(task) => setDraggingId(task.id)}
            onDragEnd={() => setDraggingId(undefined)}
            onDrop={() => {
              // La tarjeta se desmonta al cambiar de columna y su `dragend`
              // ya no llega: el arrastre se da por terminado aquí.
              setDraggingId(undefined)
              if (dragged) move(dragged, status)
            }}
          />
        ))}
      </div>
    )

    if (state.tasks.length > 0) return columns

    // El espacio no tiene ninguna tarea: se crean desde la lista.
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle>Todavía no hay tareas</CardTitle>
            <CardDescription>
              Las tareas se crean desde la lista.{' '}
              <Link
                to="/tasks"
                className="text-foreground font-medium underline"
              >
                Ir a la lista
              </Link>{' '}
              para anotar la primera.
            </CardDescription>
          </CardHeader>
        </Card>
        {columns}
      </>
    )
  }

  return (
    <div className="bg-muted/40 min-h-svh p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Tablero</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/tasks">
              <ListIcon aria-hidden="true" />
              Lista
            </Link>
          </Button>
        </div>

        <p role="status" className="sr-only">
          {announcement}
        </p>

        {renderBoard()}
      </div>
    </div>
  )
}
