import { idParam, prisma } from '../../../../db/prisma'
import { chatRow } from '../../../../utils/chats'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const chat = await prisma.aiChat.findFirst({
    where: { id: idParam(event, 'chatId'), business_id: idParam(event, 'id') },
    include: { creator: { select: { username: true } } },
  })
  if (!chat) throw createError({ statusCode: 404, message: 'Conversation not found' })
  return chatRow(chat)
})
