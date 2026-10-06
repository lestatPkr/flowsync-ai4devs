import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Columns3Icon } from 'lucide-react'
import { useAuth } from '@/auth/use-auth'
import { ApiError, listTasks, spaceHasTasks } from '@/lib/api'
import {
  byListOrder,
  filterButtonId,
  LIVE_STATUSES,
  STATUS_LABELS,
} from '@/lib/task-status'
import { useTaskFilter } from '@/routes/use-task-filter'
import { TaskForm } from '@/components/tasks/task-form'
import { TaskList } from '@/components/tasks/task-list'
import { TaskStatusFilter } from '@/components/tasks/task-status-filter'
import { EmptyTasksState } from '@/components/tasks/empty-tasks-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Task, TaskStatus } from '@/lib/types'

/**
 * Lo que se sabe de la lista para un filtro. La clave es la del filtro (y el
 * intento) que la pidió: si no es la actual, la lista está cargando.
 */
type ListState =
  | {
      key: string
      filter: TaskStatus | null
      kind: 'loaded'
      tasks: Task[]
      spaceHasTasks: boolean
    }
  | { key: string; kind: 'invalid-filter'; message: string }
  | { key: string; kind: 'error'; error: ApiError }

/** El encabezado de los vacíos (a) y (c), adonde va el foco si sale la última fila. */
const EMPTY_TITLE_ID = 'task-list-empty-title'

/** Si una tarea en ese estado entra en lo que se está viendo. */
function fitsView(status: TaskStatus, filter: TaskStatus | null) {
  return filter === null ? LIVE_STATUSES.includes(status) : status === filter
}

export function TasksPage() {
  const { token } = useAuth()
  const { filter, setFilter } = useTaskFilter()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ListState>()
  const key = `${filter ?? 'default'}:${attempt}`
  const location = useLocation()
  // Solo la primera carga: volver de una tarea no debe robar el foco al filtro.
  const returnFocusTo = useRef(
    (location.state as { focusTaskId?: number } | null)?.focusTaskId,
  )
  // El filtro del último render: `TaskForm` llama a `onCreated` con el cierre
  // del envío, y el filtro puede haber cambiado mientras se creaba la tarea.
  const currentFilter = useRef(filter)
  useEffect(() => {
    currentFilter.current = filter
  }, [filter])
  // Adónde llevar el foco si la fila que lo tenía sale de la vista.
  const focusIfRemoved = useRef<
    { taskId: number; fallbackIds: string[] } | undefined
  >(undefined)

  useEffect(() => {
    if (!token) return
    let stale = false

    const load = async () => {
      const tasks = await listTasks(token, filter ?? undefined)
      const hasTasks = tasks.length > 0 || (await spaceHasTasks(token, filter))
      return { tasks, hasTasks }
    }

    load()
      .then(({ tasks, hasTasks }) => {
        if (stale) return
        setState({
          key,
          filter,
          kind: 'loaded',
          tasks,
          spaceHasTasks: hasTasks,
        })
      })
      .catch((caught: unknown) => {
        if (stale) return
        const error =
          caught instanceof ApiError
            ? caught
            : new ApiError(
                'Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.',
                0,
              )
        setState(
          error.status === 422 && error.fieldErrors.status
            ? { key, kind: 'invalid-filter', message: error.fieldErrors.status }
            : { key, kind: 'error', error },
        )
      })

    return () => {
      stale = true
    }
  }, [token, filter, key])

  const isLoaded = state?.key === key && state.kind === 'loaded'

  // Al volver de una tarea, el teclado sigue desde la tarea que se abrió.
  useEffect(() => {
    if (!isLoaded || returnFocusTo.current === undefined) return
    document.getElementById(`task-${returnFocusTo.current}-link`)?.focus()
    returnFocusTo.current = undefined
  }, [isLoaded])

  // Si la fila con el foco ha salido de la vista, el foco pasa a la siguiente,
  // a la anterior o al encabezado del vacío: nunca cae al <body>.
  useEffect(() => {
    const pending = focusIfRemoved.current
    if (!pending) return
    focusIfRemoved.current = undefined
    if (document.getElementById(`task-${pending.taskId}-link`)) return
    for (const id of pending.fallbackIds) {
      const target = document.getElementById(id)
      if (target) {
        target.focus()
        return
      }
    }
  }, [state])

  // `ProtectedRoute` garantiza que aquí ya hay sesión resuelta, con token.
  if (!token) return null

  const handleCreated = (task: Task) => {
    // Nace en «Pendiente»: con un filtro que no la incluye, a la vista por defecto.
    if (!fitsView(task.status, currentFilter.current)) {
      setFilter(null)
      return
    }
    // Se antepone solo en la vista cargada que la incluye, con su propio filtro.
    setState((current) =>
      current?.kind === 'loaded' && fitsView(task.status, current.filter)
        ? { ...current, tasks: [task, ...current.tasks], spaceHasTasks: true }
        : current,
    )
  }

  const handleUpdated = (task: Task) => {
    const row = document.getElementById(`task-${task.id}-link`)?.closest('li')
    if (row?.contains(document.activeElement)) {
      const neighbourLink = (item: Element | null) =>
        item?.querySelector('a')?.id
      focusIfRemoved.current = {
        taskId: task.id,
        fallbackIds: [
          neighbourLink(row.nextElementSibling),
          neighbourLink(row.previousElementSibling),
          EMPTY_TITLE_ID,
        ].filter((id): id is string => id !== undefined),
      }
    }

    // Se corrige la vista que está cargada, con su propio filtro.
    setState((current) => {
      if (current?.kind !== 'loaded') return current
      const others = current.tasks.filter((item) => item.id !== task.id)
      const tasks = fitsView(task.status, current.filter)
        ? [...others, task].sort(byListOrder)
        : others
      return { ...current, tasks, spaceHasTasks: true }
    })
  }

  const showDone = () => {
    // El vacío desaparece al filtrar: el foco pasa al botón de «Hecho».
    document.getElementById(filterButtonId('done'))?.focus()
    setFilter('done')
  }

  const renderList = () => {
    if (!state || state.key !== key) return null

    if (state.kind === 'invalid-filter') {
      return (
        <Alert variant="destructive">
          <AlertTitle>Ese filtro no es válido</AlertTitle>
          <AlertDescription>
            <p>{state.message}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setFilter(null)}
            >
              Volver a la vista por defecto
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    if (state.kind === 'error') {
      return (
        <Alert variant="destructive">
          <AlertTitle>No se ha podido cargar la lista</AlertTitle>
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

    if (state.tasks.length > 0) {
      return (
        <TaskList
          tasks={state.tasks}
          token={token}
          onTaskUpdated={handleUpdated}
        />
      )
    }

    if (!state.spaceHasTasks) {
      return (
        <EmptyTasksState
          onCreateFirst={() => document.getElementById('title')?.focus()}
        />
      )
    }

    if (state.filter !== null) {
      return (
        <Card className="text-center">
          <CardHeader>
            <CardTitle id={EMPTY_TITLE_ID} tabIndex={-1}>
              No hay tareas en este estado
            </CardTitle>
            <CardDescription>
              Ahora mismo ninguna tarea del equipo está en «
              {STATUS_LABELS[state.filter]}». Elige otro estado o quita el
              filtro para volver a la vista por defecto.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    }

    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle id={EMPTY_TITLE_ID} tabIndex={-1}>
            No hay nada pendiente ni en curso
          </CardTitle>
          <CardDescription>
            Todas las tareas del equipo están hechas. Para consultarlas, filtra
            por{' '}
            <button
              type="button"
              onClick={showDone}
              className="text-foreground font-medium underline"
            >
              Hecho
            </button>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="bg-muted/40 min-h-svh p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Tareas</h1>
          <Button variant="outline" size="sm" asChild>
            <Link to="/tasks/board">
              <Columns3Icon aria-hidden="true" />
              Tablero
            </Link>
          </Button>
        </div>

        <TaskForm token={token} onCreated={handleCreated} />

        <TaskStatusFilter value={filter} onChange={setFilter} />

        {renderList()}
      </div>
    </div>
  )
}
