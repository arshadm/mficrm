import { idParam, prisma } from '../../../../db/prisma'

// The company's conversations, most recently active first (shared with the team)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const chats = await prisma.aiChat.findMany({
    where: { business_id: idParam(event, 'id') },
    orderBy: { updated_at: 'desc' },
    select: { id: true, title: true, updated_at: true, messages: true, creator: { select: { username: true } } },
  })
  return chats.map(c => ({
    id: c.id,
    title: c.title,
    updated_at: c.updated_at,
    created_by_username: c.creator?.username ?? null,
    message_count: Array.isArray(c.messages) ? c.messages.length : 0,
  }))
})
