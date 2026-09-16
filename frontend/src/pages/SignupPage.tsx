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
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateEmail,
  validateNewPassword,
} from '@/lib/form-validation'

const NO_ERRORS: FormErrors = { message: '', fieldErrors: {} }

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [submitting, setSubmitting] = useState(false)

  // Se valida antes de llamar: así un formulario incompleto no devuelve los
  // mensajes en inglés de VineJS ("The email field must be defined").
  function validateLocally(): Record<string, string> {
    const fieldErrors: Record<string, string> = {}

    const emailError = validateEmail(email)
    if (emailError) {
      fieldErrors.email = emailError
    }

    const passwordError = validateNewPassword(password)
    if (passwordError) {
      fieldErrors.password = passwordError
    }

    if (password !== passwordConfirmation) {
      fieldErrors.passwordConfirmation = 'Las contraseñas no coinciden.'
    }

    return fieldErrors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const localErrors = validateLocally()
    if (Object.keys(localErrors).length > 0) {
      setErrors({ message: '', fieldErrors: localErrors })
      return
    }

    setErrors(NO_ERRORS)
    setSubmitting(true)

    try {
      // `fullName` es nullable en el backend: se manda null si no lo rellenan.
      await signup({
        fullName: fullName.trim() === '' ? null : fullName.trim(),
        email,
        password,
        passwordConfirmation,
      })
      navigate('/profile', { replace: true })
    } catch (error) {
      setErrors(toFormErrors(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      description="Regístrate para empezar a usar FlowSync."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormAlert message={errors.message} />

        <div className="space-y-2">
          <Label htmlFor="fullName">
            Nombre completo <span className="text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-invalid={Boolean(errors.fieldErrors.fullName)}
            aria-describedby={errors.fieldErrors.fullName ? 'fullName-error' : undefined}
          />
          <FieldError id="fullName-error" message={errors.fieldErrors.fullName} />
        </div>

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
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.fieldErrors.password)}
            aria-describedby={errors.fieldErrors.password ? 'password-error' : undefined}
          />
          <FieldError id="password-error" message={errors.fieldErrors.password} />
          <p className="text-xs text-muted-foreground">
            Entre {PASSWORD_MIN} y {PASSWORD_MAX} caracteres.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="passwordConfirmation">Repite la contraseña</Label>
          <Input
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            aria-invalid={Boolean(errors.fieldErrors.passwordConfirmation)}
            aria-describedby={
              errors.fieldErrors.passwordConfirmation ? 'passwordConfirmation-error' : undefined
            }
          />
          <FieldError
            id="passwordConfirmation-error"
            message={errors.fieldErrors.passwordConfirmation}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </Button>
      </form>
    </AuthLayout>
  )
}
