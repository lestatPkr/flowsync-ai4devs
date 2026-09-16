import { Loader2Icon } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}
