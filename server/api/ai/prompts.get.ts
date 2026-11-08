import { prisma } from '../../db/prisma'

// The team's saved chat prompts, in order
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  return prisma.aiPrompt.findMany({ orderBy: [{ rank: 'asc' }, { id: 'asc' }], select: { id: true, name: true, text: true } })
})
