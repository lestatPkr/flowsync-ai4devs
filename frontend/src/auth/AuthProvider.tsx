import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AuthContext, type AuthStatus } from '@/auth/auth-context'
import * as api from '@/lib/api'
import { ApiError, type LoginPayload, type SignupPayload, type User } from '@/lib/api'
import { clearToken, readToken, writeToken } from '@/lib/auth-storage'

type State = {
  status: AuthStatus
  user: User | null
}

/** Solo estos códigos significan "este token ya no sirve". */
function isRejectedToken(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', user: null })
  // El token vive en una ref para que `logout` y `refreshProfile` no dependan
  // del estado y no invaliden el contexto en cada render.
  const tokenRef = useRef<string | null>(null)

  const endSession = useCallback(() => {
    tokenRef.current = null
    clearToken()
    setState({ status: 'anonymous', user: null })
  }, [])

  // Al arrancar validamos el token guardado contra el backend: así un token
  // caducado o manipulado no deja la UI creyendo que hay sesión. Un fallo de
  // red o un 500 NO borran el token: solo un rechazo explícito del backend.
  useEffect(() => {
    const token = readToken()
    if (!token) {
      setState({ status: 'anonymous', user: null })
      return
    }

    tokenRef.current = token
    let active = true

    api
      .fetchProfile(token)
      .then((user) => {
        if (active) {
          setState({ status: 'authenticated', user })
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }
        if (isRejectedToken(error)) {
          endSession()
        } else {
          // Backend caído o sin red: se conserva el token y se pide login,
          // en vez de destruir una sesión que probablemente siga siendo válida.
          tokenRef.current = null
          setState({ status: 'anonymous', user: null })
        }
      })

    return () => {
      active = false
    }
  }, [endSession])

  const authenticate = useCallback(({ user, token }: api.AuthResponse) => {
    tokenRef.current = token
    writeToken(token)
    setState({ status: 'authenticated', user })
  }, [])

  const login = useCallback(
    async (payload: LoginPayload) => {
      authenticate(await api.login(payload))
    },
    [authenticate]
  )

  const signup = useCallback(
    async (payload: SignupPayload) => {
      authenticate(await api.signup(payload))
    },
    [authenticate]
  )

  const logout = useCallback(async () => {
    const token = tokenRef.current
    if (token) {
      // Si el token ya no vale, la sesión local se limpia igualmente.
      await api.logout(token).catch(() => undefined)
    }
    endSession()
  }, [endSession])

  const refreshProfile = useCallback(async () => {
    const token = tokenRef.current
    if (!token) {
      return
    }

    try {
      const user = await api.fetchProfile(token)
      setState({ status: 'authenticated', user })
    } catch (error) {
      // Cubre el token revocado desde otra pestaña o desde el propio backend.
      if (isRejectedToken(error)) {
        endSession()
      }
    }
  }, [endSession])

  const value = useMemo(
    () => ({ status: state.status, user: state.user, login, signup, logout, refreshProfile }),
    [state.status, state.user, login, signup, logout, refreshProfile]
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
