import type { TaskStatus } from '@/lib/types'
import { filterButtonId, STATUS_LABELS } from '@/lib/task-status'
import { Button } from '@/components/ui/button'

type TaskStatusFilterProps = {
  value: TaskStatus | null
  onChange: (value: TaskStatus | null) => void
}

/**
 * Acota la lista a un solo estado, o la devuelve a la vista por defecto. El
 * filtro aplicado se sabe sin depender del color: por `aria-pressed` y por la
 * línea que dice qué se está viendo.
 */
export function TaskStatusFilter({ value, onChange }: TaskStatusFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Nunca `disabled`: el navegador le quitaría el foco a quien usa teclado. */}
      <div
        role="group"
        aria-label="Filtrar por estado"
        className="flex flex-wrap items-center gap-2"
      >
        {(Object.entries(STATUS_LABELS) as [TaskStatus, string][]).map(
          ([status, label]) => (
            <Button
              key={status}
              id={filterButtonId(status)}
              type="button"
              size="sm"
              variant={value === status ? 'default' : 'outline'}
              aria-pressed={value === status}
              onClick={() => {
                if (value !== status) onChange(status)
              }}
            >
              {label}
            </Button>
          ),
        )}
        {value !== null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              // El botón desaparece al quitar el filtro: el foco pasa al estado
              // que estaba aplicado, para que el teclado no caiga al <body>.
              document.getElementById(filterButtonId(value))?.focus()
              onChange(null)
            }}
          >
            Quitar filtro
          </Button>
        )}
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {value === null
          ? 'Mostrando pendientes y en curso. Las tareas hechas no se muestran: filtra por «Hecho» para consultarlas.'
          : `Filtrando por «${STATUS_LABELS[value]}»: solo se muestran las tareas en ese estado.`}
      </p>
    </div>
  )
}
