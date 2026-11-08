import { prisma } from '../../../db/prisma'
import type { Prisma } from '../../../generated/prisma/client'
import Papa from 'papaparse'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const where: Prisma.BusinessWhereInput = { is_archived: false }
  if (query.stage) where.stage = String(query.stage)
  if (query.category) where.category = String(query.category)

  const businesses = await prisma.business.findMany({
    where,
    orderBy: { id: 'asc' },
    select: {
      id: true, name: true, category: true, stage: true, platform: true, asking_price: true,
      trailing_12m_revenue: true, trailing_12m_profit: true, follow_up_date: true,
      date_added: true, last_updated: true,
      assignee: { select: { username: true } },
      // Latest pending primary step
      next_steps: {
        where: { is_primary: true, status: 'pending' },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { title: true, due_date: true },
      },
    },
  })

  const rows = businesses.map(({ assignee, next_steps, ...b }) => ({
    ...b,
    assigned_to: assignee?.username ?? null,
    next_step_title: next_steps[0]?.title ?? null,
    next_step_due_date: next_steps[0]?.due_date ?? null,
  }))
  const csv = Papa.unparse(rows)

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', 'attachment; filename="businesses.csv"')
  return csv
})
