import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, SyntheticEvent } from 'react'
import { ApiError, deleteTask } from '@/lib/api'
import type { Task } from '@/lib/types'
import { Button } from '@/components/ui/button'

const FAILED_MESSAGE =
  'No se ha podido borrar la tarea. Comprueba la conexión e inténtalo de nuevo.'

/**
 * Lo que la pregunta pasa desarmada al abrirse. Un doble clic o un Enter de
 * más sobre «Borrar tarea» caen dentro de la pregunta recién abierta: en ese
 * margen no responden ni cancelan, y la pregunta sigue esperando un gesto
 * deliberado. Cubre el umbral de doble clic y la repetición de tecla habituales.
 */
const CONFIRM_GUARD_MS = 500

type DeleteTaskDialogProps = {
  task: Pick<Task, 'id' | 'title'>
  token: string
  open: boolean
  onCancel: () => void
  onDeleted: () => void
  onNotFound: (error: ApiError) => void
}

/**
 * La pregunta antes de borrar una tarea: modal, nombra la tarea y dice que no
 * hay vuelta atrás. Es un `<dialog>` nativo, pero React decide si está
 * abierto: cerrarlo por su cuenta (Escape) se convierte en `onCancel`. El foco
 * nace en «Cancelar» y no sale de la pregunta mientras está abierta.
 */
export function DeleteTaskDialog({
  task,
  token,
  open,
  onCancel,
  onDeleted,
  onNotFound,
}: DeleteTaskDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef(open)
  // Con un `setTimeout` (no comparando instantes) para que los e2e controlen
  // el tiempo con `page.clock`.
  const armed = useRef(false)
  // Una sola petición en vuelo: lo que se pulse mientras dura no hace nada.
  const inFlight = useRef(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    openRef.current = open
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
    if (!open) return

    armed.current = false
    const guard = setTimeout(() => {
      armed.current = true
    }, CONFIRM_GUARD_MS)
    return () => {
      clearTimeout(guard)
      armed.current = false
    }
  }, [open])

  function cancel() {
    if (inFlight.current) return
    setError(undefined)
    onCancel()
  }

  // Escape cancela siempre, también desarmada. React es la única fuente de
  // verdad de si está abierta.
  function handleCancelEvent(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    cancel()
  }

  // El contenido va en un `div` y el <dialog> no tiene padding: un clic cuyo
  // destino es el propio <dialog> solo puede venir del fondo.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget && armed.current) cancel()
  }

  // Con dos botones, Tab y Mayús+Tab dan la vuelta sin salir de la pregunta.
  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const first = cancelRef.current
    const last = confirmRef.current
    const focused = document.activeElement
    if (event.shiftKey && focused === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && focused === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  // Chromium cierra el <dialog> sin dejar cancelarlo si no ha habido una
  // activación del usuario desde el último Escape.
  function handleCloseEvent() {
    // El evento llega en una tarea aparte: si entretanto se volvió a abrir, es
    // el de un cierre anterior y no cuenta.
    if (!openRef.current || dialogRef.current?.open) return
    if (inFlight.current) {
      dialogRef.current?.showModal()
      return
    }
    cancel()
  }

  function confirm() {
    if (inFlight.current || !armed.current) return
    inFlight.current = true
    setDeleting(true)
    setError(undefined)

    deleteTask(task.id, token)
      .then(() => {
        inFlight.current = false
        onDeleted()
      })
      .catch((caught: unknown) => {
        inFlight.current = false
        setDeleting(false)
        if (caught instanceof ApiError && caught.status === 404) {
          onNotFound(caught)
        } else if (caught instanceof ApiError && caught.status === 401) {
          setError(caught.message)
        } else {
          setError(FAILED_MESSAGE)
        }
      })
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-task-title"
      aria-describedby="delete-task-description"
      className="bg-card text-card-foreground backdrop:bg-background/80 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border p-0"
      onCancel={handleCancelEvent}
      onClose={handleCloseEvent}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex max-h-[calc(100svh-2rem)] flex-col gap-4 overflow-y-auto p-6">
        <h2
          id="delete-task-title"
          className="text-lg font-semibold wrap-break-word"
        >
          ¿Borrar «{task.title}»?
        </h2>
        <p
          id="delete-task-description"
          className="text-muted-foreground text-sm"
        >
          Se borrará para todo el equipo y no se podrá recuperar: no hay
          papelera ni forma de deshacerlo.
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={() => {
              if (armed.current) cancel()
            }}
          >
            Cancelar
          </Button>
          {/* El anillo de foco de siempre, no el halo tenue de la variante. */}
          <Button
            ref={confirmRef}
            variant="destructive"
            className="focus-visible:ring-ring/50 dark:focus-visible:ring-ring/50"
            onClick={confirm}
          >
            {deleting ? 'Borrando…' : 'Borrar definitivamente'}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
