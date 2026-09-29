import Task from '#models/task'
import { updateTaskStatusValidator } from '#validators/task'
import TaskTransformer from '#transformers/task_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class TaskStatusesController {
  async update({ params, request, serialize }: HttpContext) {
    const { status } = await request.validateUsing(updateTaskStatusValidator)

    const task = await Task.findOrFail(params.id)
    await task.merge({ status }).save()
    await task.load('assignee')

    return serialize(TaskTransformer.transform(task))
  }
}
