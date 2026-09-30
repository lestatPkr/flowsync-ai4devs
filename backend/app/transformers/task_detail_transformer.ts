import type Task from '#models/task'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { DateTime } from 'luxon'

/**
 * The single-task view. Kept apart from `TaskTransformer` (the list) on
 * purpose: fields that only belong to the open task must not leak into the list.
 *
 * `today` is the viewer's day: whether the task is overdue depends on who looks
 * and when, so it is computed on every read with `Task.isOverdueOn`, never stored.
 */
export default class TaskDetailTransformer extends BaseTransformer<Task> {
  constructor(
    resource: Task,
    protected today: DateTime
  ) {
    super(resource)
  }

  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status', 'createdAt']),
      assignee: this.pick(this.resource.assignee, ['id', 'fullName', 'initials']),
      dueDate: this.resource.dueDate?.toISODate() ?? null,
      isOverdue: this.resource.isOverdueOn(this.today),
    }
  }
}
