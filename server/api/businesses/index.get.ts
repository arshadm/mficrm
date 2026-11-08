import { prisma, toDate } from '../../db/prisma'
import type { Prisma } from '../../generated/prisma/client'
import { withAssignee } from '../../utils/rows'

const SORTABLE = ['name', 'asking_price', 'trailing_12m_profit', 'last_updated', 'date_added', 'follow_up_date', 'stage'] as const
type SortField = typeof SORTABLE[number]
// Prisma only accepts `nulls` ordering on columns that can be NULL
const NULLABLE: SortField[] = ['asking_price', 'trailing_12m_profit', 'follow_up_date']

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const where: Prisma.BusinessWhereInput = { is_archived: query.archived === '1' }

  if (query.stage) where.stage = String(query.stage)
  if (query.category) where.category = String(query.category)
  if (query.platform) where.platform = String(query.platform)
  if (query.assigned_to) where.assigned_to = Number(query.assigned_to)
  if (query.search) {
    // SQLite's LIKE ignored case; Postgres's doesn't, so search case-insensitively explicitly
    const contains = String(query.search)
    where.OR = ['name', 'description', 'platform'].map(f => ({ [f]: { contains, mode: 'insensitive' } }))
  }
  if (query.date_from || query.date_to) {
    where.date_added = {
      ...(query.date_from && { gte: toDate(String(query.date_from))! }),
      ...(query.date_to && { lte: toDate(String(query.date_to))! }),
    }
  }

  const sortBy: SortField = SORTABLE.includes(query.sort_by as SortField) ? query.sort_by as SortField : 'last_updated'
  const sort = query.sort_dir === 'asc' ? 'asc' : 'desc'
  // Businesses without a value sort last either way
  const orderBy = { [sortBy]: NULLABLE.includes(sortBy) ? { sort, nulls: 'last' } : sort } as Prisma.BusinessOrderByWithRelationInput

  const businesses = await prisma.business.findMany({
    where,
    orderBy,
    include: { assignee: { select: { username: true, email: true } } },
  })
  return businesses.map(withAssignee)
})
