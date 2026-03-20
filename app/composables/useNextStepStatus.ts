import type { NextStepStatus } from '~/shared/types'

export interface NextStepStatusResult {
  label: string
  colour: string
  badgeClass: string
  isOverdue: boolean
  daysUntilDue: number
}

export function useNextStepStatus() {
  function getStatus(dueDate: string | null | undefined, status: NextStepStatus = 'pending'): NextStepStatusResult {
    if (status === 'done') {
      return { label: 'Done', colour: 'emerald', badgeClass: 'bg-emerald-100 text-emerald-800', isOverdue: false, daysUntilDue: 0 }
    }
    if (status === 'skipped') {
      return { label: 'Skipped', colour: 'gray', badgeClass: 'bg-gray-100 text-gray-600', isOverdue: false, daysUntilDue: 0 }
    }

    if (!dueDate) {
      return { label: 'No date', colour: 'gray', badgeClass: 'bg-gray-100 text-gray-600', isOverdue: false, daysUntilDue: 0 }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDate + 'T00:00:00')
    const diffMs = due.getTime() - today.getTime()
    const daysUntilDue = Math.ceil(diffMs / 86400000)

    if (daysUntilDue < 0) {
      return {
        label: `Overdue (${Math.abs(daysUntilDue)}d)`,
        colour: 'red',
        badgeClass: 'bg-red-100 text-red-700 font-semibold',
        isOverdue: true,
        daysUntilDue,
      }
    }
    if (daysUntilDue === 0) {
      return { label: 'Due today', colour: 'red', badgeClass: 'bg-red-100 text-red-700 font-semibold', isOverdue: false, daysUntilDue: 0 }
    }
    if (daysUntilDue <= 2) {
      return { label: `Due in ${daysUntilDue}d`, colour: 'amber', badgeClass: 'bg-amber-100 text-amber-700', isOverdue: false, daysUntilDue }
    }
    return { label: `Due ${dueDate}`, colour: 'green', badgeClass: 'bg-emerald-100 text-emerald-700', isOverdue: false, daysUntilDue }
  }

  function getKanbanDotClass(dueDate: string | null | undefined, status: NextStepStatus = 'pending'): string {
    if (!dueDate || status !== 'pending') return 'text-gray-400'
    const s = getStatus(dueDate, status)
    if (s.isOverdue || s.daysUntilDue === 0) return 'text-red-500'
    if (s.daysUntilDue <= 2) return 'text-amber-500'
    return 'text-emerald-500'
  }

  return { getStatus, getKanbanDotClass }
}
