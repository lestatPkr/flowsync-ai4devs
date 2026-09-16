import { ApiError } from '@/lib/api'
import type { ApiErrorDetail } from '@/lib/api'

export type FormErrors = {
  /** Mensaje para la alerta general del formulario, vacío si todo fue a campos. */
  message: string
  /** Mensaje por campo, indexado por el nombre que usa el backend. */
  fieldErrors: Record<string, string>
}

const EMPTY: FormErrors = { message: '', fieldErrors: {} }

const GENERIC = 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.'

/**
 * Traduce los errores del backend (en inglés, y en jerga de VineJS) a algo
 * accionable para quien está rellenando el formulario. Se mapea por `rule`
 * antes que por texto: el mensaje literal cambia entre versiones, la regla no.
 */
function translate(detail: ApiErrorDetail): string {
  if (detail.rule === 'database.unique' && detail.field === 'email') {
    return 'Ese email ya está registrado.'
  }

  switch (detail.rule) {
    case 'required':
      return 'Este campo es obligatorio.'
    case 'email':
      return 'Introduce un email válido.'
    case 'sameAs':
      return 'Las contraseñas no coinciden.'
    case 'minLength':
    case 'maxLength':
      return detail.field === 'password' || detail.field === 'passwordConfirmation'
        ? 'La contraseña debe tener entre 8 y 32 caracteres.'
        : 'La longitud de este campo no es válida.'
    default:
      break
  }

  switch (detail.message) {
    case 'Invalid user credentials':
      return 'Email o contraseña incorrectos.'
    case 'Unauthorized access':
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión.'
    default:
      // Nunca se deja escapar el mensaje crudo del backend a la interfaz.
      return GENERIC
  }
}

export function toFormErrors(error: unknown): FormErrors {
  if (!(error instanceof ApiError)) {
    return { ...EMPTY, message: GENERIC }
  }

  const fieldErrors: Record<string, string> = {}
  const generalMessages: string[] = []

  for (const detail of error.details) {
    const message = translate(detail)
    if (detail.field) {
      // Si un campo acumula varios errores se muestra el primero; los
      // siguientes van a la alerta para que ninguno se pierda en silencio.
      if (fieldErrors[detail.field]) {
        generalMessages.push(message)
      } else {
        fieldErrors[detail.field] = message
      }
    } else {
      generalMessages.push(message)
    }
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const message = generalMessages[0] ?? (hasFieldErrors ? '' : GENERIC)

  return { message, fieldErrors }
}
