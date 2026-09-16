import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' })

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  if (!user) {
    return null
  }

  async function handleLogout() {
    setLeaving(true)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {user.initials}
            </span>
            <div>
              <CardTitle>{user.fullName ?? 'Sin nombre'}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Miembro desde</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </dl>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="lg" onClick={handleLogout} disabled={leaving}>
            {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </CardFooter>
      </Card>
    </main>
  )
}
