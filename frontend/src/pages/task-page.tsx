import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useAuth } from '@/auth/use-auth'
import { ApiError, getTask, INVALID_DATE_MESSAGE, setDueDate } from '@/lib/api'
import { STATUS_LABELS } from '@/lib/task-status'
import type { TaskDetail } from '@/lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/field-error'
import { FullScreenLoader } from '@/components/full-screen-loader'

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeStyle: 'short',
})

// La fecha de vencimiento es un día, no un instante: se formatea en UTC para
// que medianoche UTC no se convierta en el día anterior en otro huso.
const dueDateFormatter = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

const SAVE_DELAY_MS = 500

const SAVE_FAILED_MESSAGE =
  'No se ha podido guardar la fecha. Comprueba la conexión e inténtalo de nuevo.'

/** Un día completo que se puede enviar: 'AAAA-MM-DD' con un año de cuatro cifras. */
function isCompleteDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1000
}

/**
 * `key` identifica la petición (id + intento) de la que viene el resultado: si
 * no coincide con la actual, lo que hay es de otra tarea o de un intento
 * anterior, y se trata como «cargando».
 */
type LoadState =
  | { key: string; kind: 'loaded'; task: TaskDetail }
  | { key: string; kind: 'not-found' | 'error'; error: ApiError }

type BackToListProps = {
  focusTaskId?: number
}

/** Vuelve adonde se abrió la tarea: al tablero si se llegó desde él, si no a la lista. */
function BackToList({ focusTaskId }: BackToListProps) {
  const location = useLocation()
  const fromBoard =
    (location.state as { from?: string } | null)?.from === 'board'

  return (
    <Button variant="link" asChild className="self-start px-0">
      <Link
        to={fromBoard ? '/tasks/board' : '/tasks'}
        state={focusTaskId === undefined ? undefined : { focusTaskId }}
      >
        <ArrowLeftIcon />
        {fromBoard ? 'Volver al tablero' : 'Volver a la lista'}
      </Link>
    </Button>
  )
}

type DueDateRowProps = {
  task: TaskDetail
  token: string
  onSaved: (task: TaskDetail) => void
  onNotFound: (error: ApiError) => void
}

/**
 * La fecha de vencimiento de la tarea: se guarda sola al cambiar, sin botón ni
 * confirmación, y se quita con «Quitar fecha». El campo no es controlado para
 * no pelear con la edición por segmentos del `input type="date"` nativo:
 * cambiar su `key` lo vuelve a pintar con la fecha guardada.
 */
function DueDateRow({ task, token, onSaved, onNotFound }: DueDateRowProps) {
  const [error, setError] = useState<string>()
  const [fieldKey, setFieldKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // `undefined` = nada pendiente; `null` = quitar la fecha.
  const pending = useRef<string | null | undefined>(undefined)
  const inFlight = useRef(false)
  const queued = useRef<{ value: string | null; focus: boolean }>(undefined)
  const focusAfterReset = useRef(false)
  // Respuesta buena que no se pintó porque había otra petición detrás.
  const unpainted = useRef<TaskDetail>(undefined)
  const latestTask = useRef(task)

  useEffect(() => {
    latestTask.current = task
  }, [task])

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (focusAfterReset.current) {
      focusAfterReset.current = false
      inputRef.current?.focus()
    }
  }, [fieldKey])

  /** Vuelve a pintar el campo con la fecha guardada; `focus` lo deja con el foco. */
  function resetField(focus: boolean) {
    focusAfterReset.current = focus
    setFieldKey((current) => current + 1)
  }

  function cancelPending() {
    clearTimeout(timer.current)
    pending.current = undefined
  }

  function schedule(value: string) {
    cancelPending()
    pending.current = value
    timer.current = setTimeout(flush, SAVE_DELAY_MS)
  }

  function flush() {
    const value = pending.current
    cancelPending()
    if (value !== undefined) save(value)
  }

  function isFieldFocused() {
    return document.activeElement === inputRef.current
  }

  /** Hay algo tecleado que aún no ha salido: repintar el campo lo borraría. */
  function isEditing() {
    return (
      pending.current !== undefined ||
      Boolean(inputRef.current?.validity.badInput)
    )
  }

  /**
   * Tras cada respuesta el campo acaba mostrando la fecha guardada, salvo que
   * se esté escribiendo otra. `focus` («Quitar fecha») lo repinta siempre y le
   * devuelve el foco, aunque tuviera una fecha a medias.
   */
  function syncField(savedDueDate: string | null, focus: boolean) {
    if (focus) {
      resetField(true)
    } else if (
      !isEditing() &&
      inputRef.current?.value !== (savedDueDate ?? '')
    ) {
      resetField(isFieldFocused())
    }
  }

  /**
   * Nunca dos peticiones a la vez: la última pendiente sale cuando acaba la
   * anterior. `focus` devuelve el foco al campo al terminar («Quitar fecha»).
   */
  function save(value: string | null, focus = false) {
    if (inFlight.current) {
      queued.current = { value, focus: focus || Boolean(queued.current?.focus) }
      return
    }
    inFlight.current = true

    setDueDate(task.id, value, token)
      .then((saved) => {
        inFlight.current = false
        if (sendQueued()) {
          unpainted.current = saved
          return
        }
        unpainted.current = undefined
        setError(undefined)
        onSaved(saved)
        syncField(saved.dueDate, focus)
      })
      .catch((caught: unknown) => {
        inFlight.current = false
        if (sendQueued()) return
        if (caught instanceof ApiError && caught.status === 404) {
          onNotFound(caught)
          return
        }
        // Lo último guardado de verdad es lo que tiene que quedar a la vista.
        const saved = unpainted.current ?? latestTask.current
        unpainted.current = undefined
        if (saved !== latestTask.current) onSaved(saved)
        if (caught instanceof ApiError && caught.status === 422) {
          setError(caught.fieldErrors.dueDate ?? caught.message)
        } else if (caught instanceof ApiError && caught.status === 401) {
          setError(caught.message)
        } else {
          setError(SAVE_FAILED_MESSAGE)
        }
        syncField(saved.dueDate, focus)
      })
  }

  /** Solo se pinta la respuesta de la última petición. */
  function sendQueued() {
    const next = queued.current
    if (next === undefined) return false
    queued.current = undefined
    save(next.value, next.focus)
    return true
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { value, validity } = event.currentTarget
    if (!validity.badInput && isCompleteDay(value)) {
      schedule(value)
    } else {
      // A medio escribir, imposible o vacío: nunca sustituye a la fecha guardada.
      cancelPending()
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    if (pending.current !== undefined) {
      flush()
      return
    }
    const { value, validity } = event.currentTarget
    if (validity.badInput || (value !== '' && !isCompleteDay(value))) {
      setError(INVALID_DATE_MESSAGE)
    } else if (value === '' && task.dueDate !== null) {
      // Borrar los segmentos no quita la fecha: para eso está el botón.
      resetField(false)
    }
  }

  function handleRemove() {
    cancelPending()
    save(null, true)
  }

  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">
        <Label htmlFor="due-date">Vence el</Label>
      </dt>
      <dd className="flex flex-col items-end gap-2">
        <Input
          key={fieldKey}
          ref={inputRef}
          id="due-date"
          type="date"
          className="w-auto"
          defaultValue={task.dueDate ?? ''}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'due-date-error' : undefined}
          onChange={handleChange}
          onBlur={handleBlur}
        />
        {task.dueDate !== null && (
          <>
            <p className="font-medium">
              Vence el{' '}
              {dueDateFormatter.format(new Date(`${task.dueDate}T00:00:00Z`))}
            </p>
            <Button variant="outline" size="sm" onClick={handleRemove}>
              Quitar fecha
            </Button>
          </>
        )}
        {/* Siempre presente, para que se anuncie cuando aparece o desaparece. */}
        <div role="status">
          {task.isOverdue && (
            <span className="text-destructive font-medium">Vencida</span>
          )}
        </div>
        <FieldError id="due-date-error" message={error} />
      </dd>
    </div>
  )
}

/** Una tarea por sí sola: se consulta, y se le pone o quita la fecha de vencimiento. */
export function TaskPage() {
  const { id = '' } = useParams()
  const { token } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<LoadState>()
  const key = `${id}:${attempt}`

  useEffect(() => {
    if (!token) return
    let stale = false

    getTask(id, token)
      .then((task) => {
        if (!stale) setState({ key, kind: 'loaded', task })
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
        setState({
          key,
          kind: error.status === 404 ? 'not-found' : 'error',
          error,
        })
      })

    return () => {
      stale = true
    }
  }, [id, token, key])

  // `ProtectedRoute` garantiza que aquí ya hay sesión resuelta, con token.
  if (!token) return null

  if (!state || state.key !== key) return <FullScreenLoader />

  return (
    <div className="bg-muted/40 min-h-svh p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {state.kind === 'loaded' ? (
          <>
            <BackToList focusTaskId={state.task.id} />
            <Card>
              <CardHeader>
                <h1 className="text-2xl font-semibold wrap-break-word">
                  {state.task.title}
                </h1>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Responsable</dt>
                    <dd className="font-medium">
                      {state.task.assignee.fullName ?? 'Sin nombre'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Estado</dt>
                    <dd className="font-medium">
                      {STATUS_LABELS[state.task.status]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Creada el</dt>
                    <dd className="font-medium">
                      {dateFormatter.format(new Date(state.task.createdAt))}
                    </dd>
                  </div>
                  <DueDateRow
                    task={state.task}
                    token={token}
                    onSaved={(task) =>
                      setState((current) =>
                        current?.key === key
                          ? { key, kind: 'loaded', task }
                          : current,
                      )
                    }
                    onNotFound={(error) =>
                      setState((current) =>
                        current?.key === key
                          ? { key, kind: 'not-found', error }
                          : current,
                      )
                    }
                  />
                </dl>
              </CardContent>
            </Card>
          </>
        ) : state.kind === 'not-found' ? (
          <>
            <BackToList />
            <Alert>
              <AlertTitle>Esta tarea ya no existe</AlertTitle>
              <AlertDescription>{state.error.message}</AlertDescription>
            </Alert>
          </>
        ) : (
          <>
            <BackToList />
            <Alert variant="destructive">
              <AlertTitle>No se ha podido cargar la tarea</AlertTitle>
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
          </>
        )}
      </div>
    </div>
  )
}
