import { idParam, prisma } from '../../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const result = await prisma.aiChat.deleteMany({ where: { id: idParam(event, 'chatId'), business_id: idParam(event, 'id') } })
  if (!result.count) throw createError({ statusCode: 404, message: 'Conversation not found' })
  return { success: true }
})
