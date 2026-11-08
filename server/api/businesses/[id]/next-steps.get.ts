import { idParam, prisma } from '../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const users = {
    completed_by_user: { select: { username: true } },
    created_by_user: { select: { username: true } },
  } as const

  // Primary pending step
  const primaryRow = await prisma.nextStep.findFirst({
    where: { business_id, is_primary: true, status: 'pending' },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    include: users,
  })

  // Sub-tasks of the active primary step
  const subtasks = primaryRow
    ? await prisma.nextStep.findMany({
        where: { parent_id: primaryRow.id, is_primary: false },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      })
    : []

  // History: all non-pending primaries (SQLite put never-completed ones last; keep that)
  const historyRows = await prisma.nextStep.findMany({
    where: { business_id, is_primary: true, status: { not: 'pending' } },
    orderBy: [{ completed_at: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    include: { completed_by_user: users.completed_by_user },
  })

  const primary = primaryRow && (({ completed_by_user, created_by_user, ...s }) => ({
    ...s,
    completed_by_username: completed_by_user?.username ?? null,
    created_by_username: created_by_user?.username ?? null,
  }))(primaryRow)

  const history = historyRows.map(({ completed_by_user, ...s }) => ({
    ...s,
    completed_by_username: completed_by_user?.username ?? null,
  }))

  return { primary: primary || null, subtasks, history }
})
