import { idParam, orNotFound, prisma } from '../../../db/prisma'

// Created empty on first view
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  return orNotFound(
    prisma.businessCase.upsert({ where: { business_id }, create: { business_id }, update: {} }),
    'Business not found',
  )
})
