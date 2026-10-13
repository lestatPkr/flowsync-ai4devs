import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * «Se ha borrado «…».», de un solo uso: lo que trae la navegación al volver de
 * borrar una tarea se lee al montar y se quita del historial, para que recargar
 * no lo repita. Recibe el foco para que se anuncie (la tarea, que lo tenía, ya
 * no existe). Sin «Deshacer»: no hay forma de recuperarla.
 */
export function TaskDeletedNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const title = useRef(
    (location.state as { deletedTaskTitle?: string } | null)?.deletedTaskTitle,
  )
  const noticeRef = useRef<HTMLParagraphElement>(null)

  // Solo la primera vez: después `title` ya no se relee y el estado se ha quitado.
  const cleared = useRef(false)
  useEffect(() => {
    if (title.current === undefined || cleared.current) return
    cleared.current = true
    navigate(location, { replace: true, state: null })
    noticeRef.current?.focus()
  }, [location, navigate])

  if (title.current === undefined) return null

  return (
    <p
      ref={noticeRef}
      role="status"
      tabIndex={-1}
      className="text-muted-foreground rounded-sm wrap-break-word outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Se ha borrado «{title.current}».
    </p>
  )
}
