import vine from '@vinejs/vine'

/**
 * Validator to use when creating a task. Only the title is accepted:
 * assignee and status are fixed by the server, never read from the body.
 */
export const createTaskValidator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(200),
})
