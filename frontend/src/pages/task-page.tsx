import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useAuth } from '@/auth/use-auth'
import { ApiError, DATE_ERROR_MESSAGE, getTask, setDueDate } from '@/lib/api'
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

function BackToList({ focusTaskId }: BackToListProps) {
  return (
    <Button variant="link" asChild className="self-start px-0">
      <Link
        to="/tasks"
        state={focusTaskId === undefined ? undefined : { focusTaskId }}
      >
        <ArrowLeftIcon />
        Volver a la lista
      </Link>
    </Button>
  )
}

type DueDateFieldProps = {
  task: TaskDetail
  token: string
  onSaved: (task: TaskDetail) => void
  onGone: (error: ApiError) => void
}

const DUE_DATE_INPUT_ID = 'task-due-date'
const DUE_DATE_ERROR_ID = 'task-due-date-error'
const OVERDUE_ID = 'task-overdue'

/**
 * La fecha de vencimiento: se guarda sola al salir del campo o con Enter, sin
 * botón de guardar. Vaciar el campo o «Quitar fecha» la quitan sin confirmación.
 * Una fecha a medio escribir no llega a la API: se avisa y vuelve la guardada.
 */
function DueDateField({ task, token, onSaved, onGone }: DueDateFieldProps) {
  const [draft, setDraft] = useState(task.dueDate ?? '')
  const [error, setError] = useState<string>()
  const inputRef = useRef<HTMLInputElement>(null)
  // Solo cuenta la respuesta del último cambio, si el miembro encadena varios.
  const latestRequest = useRef(0)
  // Lo último que se pidió guardar (aunque siga en vuelo) y lo último guardado:
  // comparar con la prop `task` descartaría un cambio hecho mientras otro viaja.
  const requested = useRef(task.dueDate)
  const saved = useRef(task.dueDate)

  async function save(next: string | null) {
    if (next === requested.current) return
    requested.current = next
    const requestId = ++latestRequest.current
    setError(undefined)

    try {
      const updated = await setDueDate(task.id, next, token)
      if (requestId !== latestRequest.current) return
      saved.current = updated.dueDate
      requested.current = updated.dueDate
      setDraft(updated.dueDate ?? '')
      onSaved(updated)
    } catch (caught: unknown) {
      if (requestId !== latestRequest.current) return
      requested.current = saved.current
      setDraft(saved.current ?? '')
      if (caught instanceof ApiError && caught.status === 404) {
        onGone(caught)
      } else if (caught instanceof ApiError && caught.status === 422) {
        setError(caught.fieldErrors.dueDate ?? caught.message)
      } else {
        const reason =
          caught instanceof ApiError
            ? caught.message
            : 'Inténtalo de nuevo en un momento.'
        setError(`No se ha podido guardar la fecha. ${reason}`)
      }
    }
  }

  function commit(input: HTMLInputElement) {
    // Un campo nativo a medio escribir también da `value === ''`; solo
    // `badInput` lo distingue de un campo vaciado a propósito.
    if (input.validity.badInput) {
      setError(DATE_ERROR_MESSAGE)
      setDraft(saved.current ?? '')
      return
    }
    void save(input.value === '' ? null : input.value)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commit(event.currentTarget)
  }

  function removeDueDate() {
    setDraft('')
    void save(null)
    // El botón desaparece al quitar la fecha: el foco vuelve al campo, no a `body`.
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          id={DUE_DATE_INPUT_ID}
          type="date"
          className="w-auto"
          value={draft}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [task.isOverdue && OVERDUE_ID, error && DUE_DATE_ERROR_ID]
              .filter(Boolean)
              .join(' ') || undefined
          }
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={handleKeyDown}
        />
        {/* La señal es el texto; el color solo la refuerza. La decide el backend.
            La región viva existe siempre para que un lector de pantalla anuncie el cambio. */}
        <span aria-live="polite">
          {task.isOverdue && (
            <span id={OVERDUE_ID} className="text-destructive font-semibold">
              Vencida
            </span>
          )}
        </span>
        {task.dueDate !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={removeDueDate}
          >
            Quitar fecha
          </Button>
        )}
      </div>
      <div aria-live="polite">
        <FieldError id={DUE_DATE_ERROR_ID} message={error} />
      </div>
    </div>
  )
}

/** Una tarea por sí sola: se consulta y, de momento, solo se le cambia la fecha. */
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
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground pt-2">
                      <Label
                        htmlFor={DUE_DATE_INPUT_ID}
                        className="font-normal"
                      >
                        Vence el
                      </Label>
                    </dt>
                    <dd>
                      <DueDateField
                        task={state.task}
                        token={token}
                        onSaved={(task) =>
                          setState({ key, kind: 'loaded', task })
                        }
                        onGone={(error) =>
                          setState({ key, kind: 'not-found', error })
                        }
                      />
                    </dd>
                  </div>
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
