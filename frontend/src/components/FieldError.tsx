/** Mensaje de error bajo un input. No pinta nada si el campo está bien. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null
  }

  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  )
}
