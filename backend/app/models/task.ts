import { TaskSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export default class Task extends TaskSchema {
  declare status: TaskStatus

  @belongsTo(() => User, { foreignKey: 'assigneeId' })
  declare assignee: BelongsTo<typeof User>
}
