const TOKEN_KEY = 'flowsync.token'

/**
 * El acceso a localStorage puede lanzar (modo privado, cookies bloqueadas),
 * así que cada operación degrada a "sin token" en vez de romper la app.
 */
export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function writeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Sesión solo en memoria si el navegador no deja persistir.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nada que limpiar si no se pudo escribir.
  }
}
