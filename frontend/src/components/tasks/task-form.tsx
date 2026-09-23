import { useState } from 'react'
import { useAuthForm } from '@/auth/use-auth-form'
import { createTask } from '@/lib/api'
import type { Task } from '@/lib/types'
import { FieldError } from '@/components/field-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const FIELDS = ['title'] as const

type TaskFormProps = {
  token: string
  onCreated: (task: Task) => void
}

/** Formulario de un solo campo: escribir el título ya crea la tarea. */
export function TaskForm({ token, onCreated }: TaskFormProps) {
  const { isSubmitting, fieldErrors, submit } = useAuthForm(FIELDS)
  const [title, setTitle] = useState('')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    return submit(async () => {
      const task = await createTask({ title }, token)
      setTitle('')
      onCreated(task)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2" noValidate>
      <div className="grid flex-1 gap-2">
        <Label htmlFor="title" className="sr-only">
          Título de la tarea
        </Label>
        <Input
          id="title"
          name="title"
          placeholder="¿En qué andas?"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={fieldErrors.title ? 'title-error' : undefined}
        />
        <FieldError id="title-error" message={fieldErrors.title} />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creando…' : 'Crear tarea'}
      </Button>
    </form>
  )
}
