import type Task from '#models/task'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class TaskTransformer extends BaseTransformer<Task> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status', 'createdAt']),
      assignee: {
        ...this.pick(this.resource.assignee, ['id', 'initials']),
        // El alta guarda el nombre tal como llega: en la lista, sin espacios sobrantes.
        // El nombre es opcional: sin él, sigue siendo null.
        fullName: this.resource.assignee.fullName?.trim() ?? null,
      },
    }
  }
}
