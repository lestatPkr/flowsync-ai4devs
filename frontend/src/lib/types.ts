/**
 * Espejo de `UserTransformer` del backend (app/transformers/user_transformer.ts).
 */
export type User = {
  id: number
  fullName: string | null
  email: string
  initials: string
  createdAt: string
  updatedAt: string
}

/**
 * Respuesta de `POST /auth/signup` y `POST /auth/login`, ya sin el envoltorio `{ data }`.
 */
export type AuthResult = {
  user: User
  token: string
}

export type SignupPayload = {
  /** El backend lo declara `.nullable()`: la clave debe viajar siempre, aunque valga `null`. */
  fullName: string | null
  email: string
  password: string
  passwordConfirmation: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'done'

/**
 * Espejo de `TaskTransformer` del backend (app/transformers/task_transformer.ts).
 */
export type Task = {
  id: number
  title: string
  status: TaskStatus
  assignee: Pick<User, 'id' | 'fullName' | 'initials'>
  createdAt: string
}

/**
 * Espejo de `TaskDetailTransformer` del backend (app/transformers/task_detail_transformer.ts):
 * la tarea abierta. La lista (`Task`) no lleva ni la fecha ni el vencimiento.
 */
export type TaskDetail = Task & {
  /** Día natural `AAAA-MM-DD`, o `null` si la tarea no tiene fecha. */
  dueDate: string | null
  /** Lo decide el backend con el día de hoy de quien mira; el frontend no lo calcula. */
  isOverdue: boolean
}
