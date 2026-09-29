import Task from '#models/task'
import { taskReadingDayValidator, updateTaskDueDateValidator } from '#validators/task'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class TaskDueDatesController {
  async update({ params, request, serialize }: HttpContext) {
    const { dueDate } = await request.validateUsing(updateTaskDueDateValidator, {
      data: request.body(),
    })
    const { today } = await request.validateUsing(taskReadingDayValidator, {
      data: request.qs(),
    })

    const task = await Task.findOrFail(params.id)
    await task.merge({ dueDate }).save()
    await task.load('assignee')

    return serialize(TaskDetailTransformer.transform(task, today ?? DateTime.utc()))
  }
}
