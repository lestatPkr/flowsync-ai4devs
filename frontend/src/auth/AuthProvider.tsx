import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthStatus } from '@/auth/auth-context'
import * as api from '@/lib/api'
import type { LoginPayload, SignupPayload, User } from '@/lib/api'
import { clearToken, readToken, writeToken } from '@/lib/auth-storage'

type State = {
  status: AuthStatus
  user: User | null
  token: string | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', user: null, token: null })

  // Al arrancar validamos el token guardado contra el backend: así un token
  // caducado o manipulado no deja la UI creyendo que hay sesión.
  useEffect(() => {
    const token = readToken()
    if (!token) {
      setState({ status: 'anonymous', user: null, token: null })
      return
    }

    let active = true
    api
      .fetchProfile(token)
      .then((user) => {
        if (active) {
          setState({ status: 'authenticated', user, token })
        }
      })
      .catch(() => {
        clearToken()
        if (active) {
          setState({ status: 'anonymous', user: null, token: null })
        }
      })

    return () => {
      active = false
    }
  }, [])

  const authenticate = useCallback(({ user, token }: api.AuthResponse) => {
    writeToken(token)
    setState({ status: 'authenticated', user, token })
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
    const { token } = state
    if (token) {
      // Si el token ya no vale, la sesión local se limpia igualmente.
      await api.logout(token).catch(() => undefined)
    }
    clearToken()
    setState({ status: 'anonymous', user: null, token: null })
  }, [state])

  const value = useMemo(
    () => ({ status: state.status, user: state.user, login, signup, logout }),
    [state.status, state.user, login, signup, logout]
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
