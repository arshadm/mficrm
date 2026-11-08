import { idParam, prisma } from '../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // Soft delete: set status = 'skipped'
  await prisma.nextStep.updateMany({ where: { id: idParam(event, 'stepId') }, data: { status: 'skipped', updated_at: new Date() } })
  return { success: true }
})
