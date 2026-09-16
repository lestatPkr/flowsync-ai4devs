import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { FullPageSpinner } from '@/components/FullPageSpinner'

/**
 * Mientras se valida el token guardado no redirige: si lo hiciera, cada recarga
 * de una vista protegida parpadearía pasando por el login.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <FullPageSpinner />
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  return children
}
