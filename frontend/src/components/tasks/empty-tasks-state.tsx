import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type EmptyTasksStateProps = {
  onCreateFirst: () => void
}

/** Se muestra cuando el espacio compartido todavía no tiene ninguna tarea. */
export function EmptyTasksState({ onCreateFirst }: EmptyTasksStateProps) {
  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>Todavía no hay tareas</CardTitle>
        <CardDescription>
          Esta es la lista de tareas del equipo. Escribe un título arriba y
          pulsa{' '}
          <button
            type="button"
            onClick={onCreateFirst}
            className="text-foreground font-medium underline"
          >
            Crear tarea
          </button>{' '}
          para anotar la primera.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
