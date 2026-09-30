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

/**
 * Validator to use when setting or removing the due date of a task. The key is
 * required: a real calendar day as YYYY-MM-DD (strict, past dates included), or
 * null to remove it. Any other key of the body is dropped and never persisted.
 */
export const updateTaskDueDateValidator = vine.create({
  dueDate: vine.date({ formats: ['YYYY-MM-DD'] }).nullable(),
})

/**
 * Validator for the optional `today` query param: the viewer's own day, as
 * YYYY-MM-DD, used to decide whether a task is overdue. Validate it against
 * `request.qs()` so it is never read from the body.
 */
export const todayQueryValidator = vine.create({
  today: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
})
