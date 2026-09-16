import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { FullPageSpinner } from '@/components/FullPageSpinner'

/** Login y registro: si ya hay sesión, no tiene sentido mostrarlos. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') {
    return <FullPageSpinner />
  }

  if (status === 'authenticated') {
    return <Navigate to="/profile" replace />
  }

  return children
}
