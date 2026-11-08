import { idParam, prisma } from '../../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // deleteMany: deleting a row that's already gone is still a success, as before
  await prisma.riskItem.deleteMany({ where: { id: idParam(event, 'riskId') } })
  return { success: true }
})
