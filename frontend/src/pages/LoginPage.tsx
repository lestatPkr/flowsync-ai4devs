import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/auth/useAuth'
import { AuthLayout } from '@/components/AuthLayout'
import { FieldError } from '@/components/FieldError'
import { FormAlert } from '@/components/FormAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toFormErrors, type FormErrors } from '@/lib/api-errors'
import { validateEmail, validateRequiredPassword } from '@/lib/form-validation'

const NO_ERRORS: FormErrors = { message: '', fieldErrors: {} }

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // Se valida antes de llamar: así un formulario vacío no devuelve los
    // mensajes en inglés de VineJS ("The email field must be defined").
    const fieldErrors: Record<string, string> = {}
    const emailError = validateEmail(email)
    const passwordError = validateRequiredPassword(password)
    if (emailError) fieldErrors.email = emailError
    if (passwordError) fieldErrors.password = passwordError

    if (Object.keys(fieldErrors).length > 0) {
      setErrors({ message: '', fieldErrors })
      return
    }

    setErrors(NO_ERRORS)
    setSubmitting(true)

    try {
      await login({ email, password })
      navigate('/profile', { replace: true })
    } catch (error) {
      setErrors(toFormErrors(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      description="Entra con tu email y contraseña."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/signup" className="font-medium text-foreground underline underline-offset-4">
            Regístrate
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormAlert message={errors.message} />

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.fieldErrors.email)}
            aria-describedby={errors.fieldErrors.email ? 'email-error' : undefined}
          />
          <FieldError id="email-error" message={errors.fieldErrors.email} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.fieldErrors.password)}
            aria-describedby={errors.fieldErrors.password ? 'password-error' : undefined}
          />
          <FieldError id="password-error" message={errors.fieldErrors.password} />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
