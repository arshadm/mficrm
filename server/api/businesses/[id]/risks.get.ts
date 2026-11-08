import { idParam, prisma } from '../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  return prisma.riskItem.findMany({ where: { business_id: idParam(event, 'id') }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }] })
})
