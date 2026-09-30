import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Task, { type TaskStatus } from '#models/task'

/**
 * The overdue rule lives only in `Task.isOverdueOn`. These tests build tasks in
 * memory (no database) and pin every edge of RF-14 with an explicit `today`.
 */
function taskWith(dueDate: string | null, status: TaskStatus = 'pending') {
  const task = new Task()
  task.status = status
  task.dueDate = dueDate ? DateTime.fromISO(dueDate) : null
  return task
}

const TODAY = DateTime.fromISO('2026-09-30')

test.group('Task.isOverdueOn', () => {
  test('CA-4: vencida si la fecha es el día anterior y no está hecha', ({ assert }) => {
    assert.isTrue(taskWith('2026-09-29').isOverdueOn(TODAY))
  })

  test('CA-5: vencer hoy todavía no es estar vencida (mismo día)', ({ assert }) => {
    assert.isFalse(taskWith('2026-09-30').isOverdueOn(TODAY))
  })

  test('CA-6: una fecha posterior nunca está vencida (día posterior)', ({ assert }) => {
    assert.isFalse(taskWith('2026-10-01').isOverdueOn(TODAY))
  })

  test('CA-7: sin fecha no se vence nunca', ({ assert }) => {
    assert.isFalse(taskWith(null).isOverdueOn(TODAY))
  })

  test('CA-9: una tarea hecha con la fecha pasada no está vencida', ({ assert }) => {
    assert.isFalse(taskWith('2026-09-01', 'done').isOverdueOn(TODAY))
  })

  test('RF-14: una tarea en curso con la fecha pasada está vencida', ({ assert }) => {
    assert.isTrue(taskWith('2026-09-29', 'in_progress').isOverdueOn(TODAY))
  })

  test('CA-19: dos husos, dos lecturas distintas de la misma tarea, ambas correctas', ({
    assert,
  }) => {
    const task = taskWith('2026-09-29')

    assert.isFalse(task.isOverdueOn(DateTime.fromISO('2026-09-29')))
    assert.isTrue(task.isOverdueOn(DateTime.fromISO('2026-09-30')))
  })

  test('CA-20: una tarea vence sola al cambiar el día, sin modificarla', ({ assert }) => {
    const task = taskWith('2026-09-30')

    assert.isFalse(task.isOverdueOn(DateTime.fromISO('2026-09-30')))
    assert.isTrue(task.isOverdueOn(DateTime.fromISO('2026-10-01')))
  })

  test('RF-14: compara días naturales, no instantes', ({ assert }) => {
    const task = taskWith('2026-09-30')

    const lateEveningInLosAngeles = DateTime.fromISO('2026-09-30T23:30', {
      zone: 'America/Los_Angeles',
    })
    const earlyMorningInTokyo = DateTime.fromISO('2026-10-01T00:30', { zone: 'Asia/Tokyo' })

    assert.isFalse(task.isOverdueOn(lateEveningInLosAngeles))
    assert.isTrue(task.isOverdueOn(earlyMorningInTokyo))
  })
})
