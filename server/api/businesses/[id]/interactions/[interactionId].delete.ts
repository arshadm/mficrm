import { idParam, prisma } from '../../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  await prisma.interaction.deleteMany({ where: { id: idParam(event, 'interactionId') } })
  return { success: true }
})
