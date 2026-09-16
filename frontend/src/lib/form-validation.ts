/** Mismos límites que `signupValidator` en el backend. */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 32

// Comprobación deliberadamente laxa: la validación real la hace el backend,
// esto solo evita mandar formularios obviamente incompletos y recibir de vuelta
// los mensajes en inglés de VineJS.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email: string): string | undefined {
  if (email.trim() === '') {
    return 'Introduce tu email.'
  }
  if (!EMAIL_SHAPE.test(email.trim())) {
    return 'Introduce un email válido.'
  }
  return undefined
}

export function validateRequiredPassword(password: string): string | undefined {
  return password === '' ? 'Introduce tu contraseña.' : undefined
}

export function validateNewPassword(password: string): string | undefined {
  if (password === '') {
    return 'Introduce una contraseña.'
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return `La contraseña debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres.`
  }
  return undefined
}
