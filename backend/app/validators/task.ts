import vine from '@vinejs/vine'
import { TASK_STATUSES } from '#models/task'

/**
 * Validator to use when creating a task. Only the title is accepted:
 * assignee and status are fixed by the server, never read from the body.
 */
export const createTaskValidator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(200),
})

/**
 * Validator to use when changing the status of a task. Only the status is
 * accepted: any other key of the body is dropped and never persisted.
 */
export const updateTaskStatusValidator = vine.create({
  status: vine.enum(TASK_STATUSES),
})
