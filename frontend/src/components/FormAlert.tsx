import { AlertCircleIcon } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

/** Alerta de error del formulario. No pinta nada si no hay mensaje. */
export function FormAlert({ message }: { message: string }) {
  if (!message) {
    return null
  }

  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
