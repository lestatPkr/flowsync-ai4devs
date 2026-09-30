import Task from '#models/task'
import { todayQueryValidator, updateTaskDueDateValidator } from '#validators/task'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class TaskDueDatesController {
  /**
   * Sets (a YYYY-MM-DD day) or removes (null) the due date of a task, and
   * returns the task detail with `isOverdue` read with the viewer's `today`
   * (query param; the server's own UTC day when it is missing).
   */
  async update({ params, request, serialize }: HttpContext) {
    const { dueDate } = await request.validateUsing(updateTaskDueDateValidator)
    const { today } = await request.validateUsing(todayQueryValidator, { data: request.qs() })

    // Validated dates are already Luxon DateTimes (global transform in start/validator.ts).
    const task = await Task.findOrFail(params.id)
    await task.merge({ dueDate }).save()
    await task.load('assignee')

    return serialize(TaskDetailTransformer.transform(task, today ?? DateTime.utc()))
  }
}
