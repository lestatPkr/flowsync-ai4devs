import { TaskSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'

export const TASK_STATUSES = ['pending', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** The statuses of the default view of the list: everything that is not done (RF-21). */
export const LIVE_TASK_STATUSES = [
  'pending',
  'in_progress',
] as const satisfies readonly TaskStatus[]

export default class Task extends TaskSchema {
  declare status: TaskStatus

  @belongsTo(() => User, { foreignKey: 'assigneeId' })
  declare assignee: BelongsTo<typeof User>

  /**
   * The single place of the overdue rule: it has a due date, that day is
   * strictly before `today` (the day of whoever is looking) and it is not done.
   * Compared as calendar days ('YYYY-MM-DD'), never as instants, so the zone
   * of each DateTime does not matter.
   */
  isOverdueOn(today: DateTime): boolean {
    if (this.dueDate === null || this.status === 'done') {
      return false
    }
    return this.dueDate.toISODate()! <= today.toISODate()!
  }
}
