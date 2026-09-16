import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type AuthLayoutProps = {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

/** Shell centrado que comparten las pantallas de login y registro. */
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">FlowSync</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">{children}</CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </main>
  )
}
