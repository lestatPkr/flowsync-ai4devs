import type {
  AuthResult,
  LoginPayload,
  SignupPayload,
  Task,
  TaskDetail,
  TaskStatus,
  User,
} from '@/lib/types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

/** Forma de cada error que devuelve el backend: `{ errors: [...] }`. */
type BackendError = {
  message: string
  rule?: string
  field?: string
  meta?: Record<string, unknown>
}

/**
 * Error de API con el mensaje ya traducido y listo para pintar, más los errores
 * desglosados por campo para colocarlos bajo su input correspondiente.
 */
export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: Record<string, string>

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'el nombre',
  email: 'el email',
  password: 'la contraseña',
  passwordConfirmation: 'la confirmación de la contraseña',
  title: 'el título',
  status: 'el estado',
  dueDate: 'la fecha de vencimiento',
}

const label = (field?: string) => FIELD_LABELS[field ?? ''] ?? 'el campo'

/** Mensaje de una fecha que no existe, a medio escribir o fuera de rango. */
export const INVALID_DATE_MESSAGE =
  'Esa fecha no existe o está incompleta. Escribe un día, un mes y un año de cuatro cifras.'

/**
 * Traduce un error de VineJS a una frase que el usuario pueda entender.
 * Cubre las reglas que usan `app/validators/user.ts` y `app/validators/task.ts` en el backend.
 */
function translate(error: BackendError): string {
  const { rule, field, meta } = error

  switch (rule) {
    case 'database.unique':
      return field === 'email'
        ? 'Ese email ya está registrado. Inicia sesión en su lugar.'
        : `Ya existe un registro con ${label(field)}.`
    case 'sameAs':
      return 'Las contraseñas no coinciden.'
    case 'email':
      return 'Introduce una dirección de email válida.'
    case 'required':
      return `Falta rellenar ${label(field)}.`
    case 'minLength':
      return `${label(field)} debe tener al menos ${meta?.min} caracteres.`
    case 'maxLength':
      return `${label(field)} no puede superar los ${meta?.max} caracteres.`
    case 'enum':
      return 'Ese estado no es válido. Elige Pendiente, En curso o Hecho.'
    case 'date':
    case 'date.afterOrEqual':
      return INVALID_DATE_MESSAGE
    default:
      return `Revisa ${label(field)}.`
  }
}

/**
 * Convierte una respuesta de error del backend en un `ApiError`.
 */
function toApiError(status: number, body: unknown): ApiError {
  const errors = (body as { errors?: BackendError[] } | null)?.errors

  if (status === 401) {
    return new ApiError(
      'Tu sesión ha caducado. Vuelve a iniciar sesión.',
      status,
    )
  }

  // `User.verifyCredentials` lanza E_INVALID_CREDENTIALS con un 400 sin `field`.
  if (status === 400) {
    return new ApiError('El email o la contraseña no son correctos.', status)
  }

  if (status === 422 && errors?.length) {
    const fieldErrors: Record<string, string> = {}
    for (const error of errors) {
      if (error.field && !fieldErrors[error.field]) {
        fieldErrors[error.field] = translate(error)
      }
    }

    return new ApiError(translate(errors[0]), status, fieldErrors)
  }

  return new ApiError(
    'Algo ha ido mal en el servidor. Inténtalo de nuevo en un momento.',
    status,
  )
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT'
  body?: unknown
  token?: string | null
}

async function request<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      'No se pudo conectar con el servidor. Comprueba que el backend está arrancado.',
      0,
    )
  }

  // Un 500 puede responder HTML, así que el parseo no puede darse por hecho.
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw toApiError(response.status, payload)
  }

  return payload as T
}

export function signup(payload: SignupPayload): Promise<AuthResult> {
  return request<{ data: AuthResult }>('/api/v1/auth/signup', {
    method: 'POST',
    body: payload,
  }).then((response) => response.data)
}

export function login(payload: LoginPayload): Promise<AuthResult> {
  return request<{ data: AuthResult }>('/api/v1/auth/login', {
    method: 'POST',
    body: payload,
  }).then((response) => response.data)
}

export function getProfile(token: string): Promise<User> {
  return request<{ data: User }>('/api/v1/account/profile', { token }).then(
    (response) => response.data,
  )
}

export function logout(token: string): Promise<void> {
  return request('/api/v1/account/logout', { method: 'POST', token }).then(
    () => undefined,
  )
}

export type CreateTaskPayload = {
  title: string
}

export function createTask(
  payload: CreateTaskPayload,
  token: string,
): Promise<Task> {
  return request<{ data: Task }>('/api/v1/tasks', {
    method: 'POST',
    body: payload,
    token,
  }).then((response) => response.data)
}

/** La lista de la vista por defecto (sin `status`) o la de un único estado. */
export function listTasks(token: string, status?: TaskStatus): Promise<Task[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return request<{ data: Task[] }>(`/api/v1/tasks${query}`, { token }).then(
    (response) => response.data,
  )
}

/**
 * Las tareas del tablero: una lectura por estado, en paralelo. Falla entera si
 * falla cualquiera (nunca columnas a medias) y no repite una tarea que llegue
 * en dos lecturas (se queda la primera, en el orden de las columnas).
 */
export async function listTasksByStatus(
  token: string,
): Promise<Record<TaskStatus, Task[]>> {
  const [pending, inProgress, done] = await Promise.all([
    listTasks(token, 'pending'),
    listTasks(token, 'in_progress'),
    listTasks(token, 'done'),
  ])

  const seen = new Set<number>()
  const firstAppearance = (tasks: Task[]) =>
    tasks.filter((task) => {
      if (seen.has(task.id)) return false
      seen.add(task.id)
      return true
    })

  return {
    pending: firstAppearance(pending),
    in_progress: firstAppearance(inProgress),
    done: firstAppearance(done),
  }
}

/**
 * Si el espacio tiene alguna tarea, sabiendo que la vista `emptyView` (`null`
 * es la vista por defecto) ha llegado vacía. La vista por defecto y «Hecho»
 * son una partición de todas las tareas, así que solo pide las vistas
 * complementarias que hacen falta para saberlo.
 */
export async function spaceHasTasks(
  token: string,
  emptyView: TaskStatus | null,
): Promise<boolean> {
  if (emptyView !== null) {
    const live = await listTasks(token)
    if (live.length > 0) return true
    // «Hecho» y la vista por defecto vacías: no queda ninguna tarea.
    if (emptyView === 'done') return false
  }
  const done = await listTasks(token, 'done')
  return done.length > 0
}

/**
 * El día de hoy de quien mira, 'AAAA-MM-DD', con la fecha local del navegador
 * (nunca `toISOString()`, que da el día UTC). Se calcula en cada llamada para
 * que una pestaña abierta varios días pida siempre con el día correcto.
 */
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Un 404 al leer o escribir una tarea concreta: la tarea ya no existe. */
function taskNotFound(error: unknown): never {
  // Aquí un 404 es una tarea borrada, que nunca existió o con un id que no es un número.
  if (error instanceof ApiError && error.status === 404) {
    throw new ApiError('Puede que alguien la haya borrado.', 404)
  }
  throw error
}

export function getTask(id: string, token: string): Promise<TaskDetail> {
  return request<{ data: TaskDetail }>(
    `/api/v1/tasks/${encodeURIComponent(id)}?today=${localToday()}`,
    { token },
  )
    .then((response) => response.data)
    .catch(taskNotFound)
}

/** Pone, cambia (`'AAAA-MM-DD'`) o quita (`null`) la fecha de vencimiento de una tarea. */
export function setDueDate(
  id: number,
  dueDate: string | null,
  token: string,
): Promise<TaskDetail> {
  return request<{ data: TaskDetail }>(
    `/api/v1/tasks/${id}/due-date?today=${localToday()}`,
    { method: 'PUT', body: { dueDate }, token },
  )
    .then((response) => response.data)
    .catch(taskNotFound)
}

export function updateTaskStatus(
  id: number,
  status: TaskStatus,
  token: string,
): Promise<Task> {
  return request<{ data: Task }>(`/api/v1/tasks/${id}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  })
    .then((response) => response.data)
    .catch((error: unknown) => {
      // Aquí un 404 siempre es porque la tarea ya no existe.
      if (error instanceof ApiError && error.status === 404) {
        throw new ApiError(
          'Esta tarea ya no existe: puede que alguien la haya borrado. Recarga la página para ver la lista al día.',
          404,
        )
      }
      throw error
    })
}
