import Task from '#models/task'
import { createTaskValidator } from '#validators/task'
import TaskTransformer from '#transformers/task_transformer'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import type { HttpContext } from '@adonisjs/core/http'

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

  async index({ serialize }: HttpContext) {
    const tasks = await Task.query()
      .preload('assignee')
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')

    return serialize(TaskTransformer.transform(tasks))
  }

  async show({ params, serialize }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    await task.load('assignee')

    return serialize(TaskDetailTransformer.transform(task))
  }
}
