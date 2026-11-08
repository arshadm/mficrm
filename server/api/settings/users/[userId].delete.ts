import { idParam, prisma } from '../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  // Their businesses, interactions and steps are kept, with the user reference set to null (schema onDelete: SetNull)
  await prisma.user.deleteMany({ where: { id: idParam(event, 'userId') } })
  return { success: true }
})
