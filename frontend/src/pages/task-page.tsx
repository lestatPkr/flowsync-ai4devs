import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { useAuth } from '@/auth/use-auth'
import { ApiError, getTask } from '@/lib/api'
import { STATUS_LABELS } from '@/lib/task-status'
import type { Task } from '@/lib/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  | { key: string; kind: 'loaded'; task: Task }
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

/** Una tarea por sí sola, solo para consultarla. */
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
