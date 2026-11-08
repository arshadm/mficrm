import { idParam, isNotFound, prisma } from '../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  try {
    await prisma.business.delete({ where: { id: idParam(event, 'id') } })
  } catch (err) {
    if (isNotFound(err)) throw createError({ statusCode: 404, message: 'Business not found' })
    throw err
  }
  return { success: true }
})
