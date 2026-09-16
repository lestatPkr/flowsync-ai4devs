import { ApiError } from '@/lib/api'

export type FormErrors = {
  /** Mensaje para la alerta general del formulario, vacío si todo fue a campos. */
  message: string
  /** Mensaje por campo, indexado por el nombre que usa el backend. */
  fieldErrors: Record<string, string>
}

const EMPTY: FormErrors = { message: '', fieldErrors: {} }

/**
 * Traduce mensajes concretos del backend (en inglés) a algo accionable para
 * quien está rellenando el formulario.
 */
function translate(detail: { message: string; rule?: string; field?: string }): string {
  if (detail.rule === 'database.unique' && detail.field === 'email') {
    return 'Ese email ya está registrado.'
  }

  switch (detail.message) {
    case 'Invalid user credentials':
      return 'Email o contraseña incorrectos.'
    case 'Unauthorized access':
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
    default:
      return detail.message
  }
}

export function toFormErrors(error: unknown): FormErrors {
  if (!(error instanceof ApiError)) {
    return { ...EMPTY, message: 'Ha ocurrido un error inesperado. Inténtalo de nuevo.' }
  }

  // Credenciales inválidas llegan como 400 sin `field`: es un error del
  // formulario completo, no de un input concreto.
  if (error.status === 400) {
    return { ...EMPTY, message: translate(error.details[0] ?? { message: '' }) }
  }

  const fieldErrors: Record<string, string> = {}
  const generalMessages: string[] = []

  for (const detail of error.details) {
    const message = translate(detail)
    if (detail.field && !fieldErrors[detail.field]) {
      fieldErrors[detail.field] = message
    } else if (!detail.field) {
      generalMessages.push(message)
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const message =
    generalMessages[0] ??
    (hasFieldErrors ? '' : 'Ha ocurrido un error inesperado. Inténtalo de nuevo.')

  return { message, fieldErrors }
}
