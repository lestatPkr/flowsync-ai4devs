import type Task from '#models/task'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * The single-task view. Kept apart from `TaskTransformer` (the list) on
 * purpose: fields that only belong to the open task must not leak into the list.
 */
export default class TaskDetailTransformer extends BaseTransformer<Task> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status', 'createdAt']),
      assignee: this.pick(this.resource.assignee, ['id', 'fullName', 'initials']),
    }
  }
}
