import { TaskSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'

export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export default class Task extends TaskSchema {
  declare status: TaskStatus

  @belongsTo(() => User, { foreignKey: 'assigneeId' })
  declare assignee: BelongsTo<typeof User>

  /**
   * The overdue rule (RF-14), and the only place it lives: a task is overdue
   * if and only if it has a due date strictly before `today` and it is not
   * done. Compares calendar days (`YYYY-MM-DD`), never instants, so neither
   * the hour nor the zone of `today` can add or take away a day.
   */
  isOverdueOn(today: DateTime): boolean {
    return (
      this.dueDate !== null &&
      this.dueDate.toISODate()! < today.toISODate()! &&
      this.status !== 'done'
    )
  }
}
