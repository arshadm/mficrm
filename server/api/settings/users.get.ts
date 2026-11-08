import { prisma } from '../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  return prisma.user.findMany({
    select: { id: true, username: true, email: true, role: true, created_at: true },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
  })
})
