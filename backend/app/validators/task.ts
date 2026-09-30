import vine from '@vinejs/vine'
import { TASK_STATUSES } from '#models/task'

/**
 * A calendar day, strictly 'YYYY-MM-DD', from 1000-01-01 to 9999-12-31 (the
 * upper bound comes from the four-digit year of the format). The global
 * transform of `start/validator.ts` already hands it over as a Luxon DateTime.
 */
function calendarDay() {
  return vine.date({ formats: ['YYYY-MM-DD'] }).afterOrEqual('1000-01-01')
}

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
 * Validator to use on the query string of the list. The status is optional
 * (without it, the default view) and, when given, must be exactly one of the
 * three: empty, unknown, other casing or repeated is rejected by the enum.
 */
export const listTasksValidator = vine.create({
  status: vine.enum(TASK_STATUSES).optional(),
})

/**
 * Validator to use on the body when setting the due date of a task. The key
 * is required: a day sets or changes it, `null` removes it.
 */
export const updateTaskDueDateValidator = vine.create({
  dueDate: calendarDay().nullable(),
})

/**
 * Validator to use on the query string of the reads of a task: the day of
 * reference of whoever is looking, used to decide whether it is overdue.
 */
export const taskReadingDayValidator = vine.create({
  today: calendarDay().optional(),
})
