import { idParam, prisma } from '../../db/prisma'
import { withAssignee } from '../../utils/rows'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business = await prisma.business.findUnique({
    where: { id: idParam(event, 'id') },
    include: { assignee: { select: { username: true, email: true } } },
  })
  if (!business) throw createError({ statusCode: 404, message: 'Business not found' })
  return withAssignee(business)
})
