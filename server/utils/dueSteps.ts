import { prisma } from '../db/prisma'
import type { Prisma } from '../generated/prisma/client'

/**
 * Pending primary next steps on active businesses, flattened to the row shape the dashboard and calendar use
 * (step_id, step_title, step_notes, due_date, business_id, business_name, business_category).
 */
export async function pendingPrimarySteps(due: Prisma.DateTimeFilter) {
  const steps = await prisma.nextStep.findMany({
    where: { is_primary: true, status: 'pending', due_date: due, business: { is_archived: false } },
    orderBy: [{ due_date: 'asc' }, { id: 'asc' }],
    select: {
      id: true, title: true, notes: true, due_date: true, status: true,
      business: { select: { id: true, name: true, category: true } },
    },
  })
  return steps.map(s => ({
    step_id: s.id,
    step_title: s.title,
    step_notes: s.notes,
    due_date: s.due_date,
    status: s.status,
    business_id: s.business.id,
    business_name: s.business.name,
    business_category: s.business.category,
  }))
}
