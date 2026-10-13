import Task, { LIVE_TASK_STATUSES } from '#models/task'
import { createTaskValidator, listTasksValidator, taskReadingDayValidator } from '#validators/task'
import TaskTransformer from '#transformers/task_transformer'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import { errors as lucidErrors } from '@adonisjs/lucid'
import { DateTime } from 'luxon'

const CANONICAL_ID = /^[1-9]\d*$/

export default class TasksController {
  async store({ request, response, auth, serialize }: HttpContext) {
    const { title } = await request.validateUsing(createTaskValidator)

    const task = await Task.create({
      title,
      status: 'pending',
      assigneeId: auth.getUserOrFail().id,
    })
    await task.load('assignee')

    response.status(201)
    return serialize(TaskTransformer.transform(task))
  }

  async index({ request, serialize }: HttpContext) {
    const { status } = await request.validateUsing(listTasksValidator, {
      data: request.qs(),
    })

    const query = Task.query()
      .preload('assignee')
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
    const tasks = await (status
      ? query.where('status', status)
      : query.whereIn('status', [...LIVE_TASK_STATUSES]))

    return serialize(TaskTransformer.transform(tasks))
  }

  async show({ params, request, serialize }: HttpContext) {
    const { today } = await request.validateUsing(taskReadingDayValidator, {
      data: request.qs(),
    })

    const task = await Task.findOrFail(params.id)
    await task.load('assignee')

    return serialize(TaskDetailTransformer.transform(task, today ?? DateTime.utc()))
  }

  /**
   * Deletes one task for real, whoever created or holds it (flat roles). It
   * deletes the instance it found, never a query built from the input, so a
   * request removes one row at most. Nothing records who deleted it (RNF-7),
   * and the 204 carries no body.
   */
  async destroy({ params, response }: HttpContext) {
    /**
     * Only a canonical positive integer is an id. SQLite's numeric affinity
     * would match `01`, `1.0`, `1e0` or ` 1` against the row 1 and delete it;
     * anything else answers exactly like a task that does not exist.
     */
    const id = Number(params.id)
    if (!CANONICAL_ID.test(params.id) || !Number.isSafeInteger(id)) {
      throw new lucidErrors.E_ROW_NOT_FOUND(Task)
    }

    const task = await Task.findOrFail(id)
    await task.delete()

    return response.noContent()
  }
}
