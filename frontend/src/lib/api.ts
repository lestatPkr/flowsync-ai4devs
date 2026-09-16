// `||` y no `??`: un `VITE_API_URL=` vacío en el .env debe caer al valor por defecto.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

/** Forma de los errores que devuelve AdonisJS: `{ errors: [{ message, field?, rule? }] }`. */
export type ApiErrorDetail = {
  message: string
  field?: string
  rule?: string
}

export class ApiError extends Error {
  /** `0` cuando la petición ni siquiera llegó al servidor. */
  readonly status: number
  readonly details: ApiErrorDetail[]

  constructor(status: number, details: ApiErrorDetail[]) {
    super(details[0]?.message ?? `Error HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export type User = {
  id: number
  fullName: string | null
  email: string
  initials: string
  createdAt: string
  updatedAt: string
}

export type AuthResponse = {
  user: User
  token: string
}

export type SignupPayload = {
  fullName: string | null
  email: string
  password: string
  passwordConfirmation: string
}

export type LoginPayload = {
  email: string
  password: string
}

type RequestOptions = {
  method?: string
  body?: unknown
  token?: string | null
}

function parseErrorDetails(body: unknown, status: number): ApiErrorDetail[] {
  if (body && typeof body === 'object') {
    const { errors, message } = body as { errors?: unknown; message?: unknown }

    if (Array.isArray(errors)) {
      const details = errors
        .filter((entry): entry is ApiErrorDetail => {
          return Boolean(entry) && typeof (entry as ApiErrorDetail).message === 'string'
        })
        .map(({ message: text, field, rule }) => ({ message: text, field, rule }))

      if (details.length > 0) {
        return details
      }
    }

    if (typeof message === 'string' && message.length > 0) {
      return [{ message }]
    }
  }

  return [{ message: `Error HTTP ${status}` }]
}

/**
 * Cliente único de la API. Desenvuelve el `data` que añade el ApiSerializer del
 * backend y normaliza cualquier fallo en un `ApiError`.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, [{ message: 'No se pudo conectar con el servidor.' }])
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, parseErrorDetails(payload, response.status))
  }

  // `logout` responde sin el envoltorio `data`, el resto de endpoints lo usan.
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data
  }

  return payload as T
}

export function signup(payload: SignupPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/signup', { method: 'POST', body: payload })
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/login', { method: 'POST', body: payload })
}

export function fetchProfile(token: string): Promise<User> {
  return request<User>('/api/v1/account/profile', { token })
}

export function logout(token: string): Promise<{ message: string }> {
  return request<{ message: string }>('/api/v1/account/logout', { method: 'POST', token })
}
