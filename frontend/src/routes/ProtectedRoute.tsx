import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { FullPageSpinner } from '@/components/FullPageSpinner'

/**
 * Mientras se valida el token guardado no redirige: si lo hiciera, cada recarga
 * de una vista protegida parpadearía pasando por el login.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner />
  }

  if (status === 'anonymous') {
    // Se guarda el destino para volver a él tras iniciar sesión.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
