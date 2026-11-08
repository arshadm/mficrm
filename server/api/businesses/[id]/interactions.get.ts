import { idParam, prisma } from '../../../db/prisma'
import { withUser } from '../../../utils/rows'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const interactions = await prisma.interaction.findMany({
    where: { business_id: idParam(event, 'id') },
    orderBy: [{ occurred_at: 'desc' }, { id: 'desc' }],
    include: {
      user: { select: { username: true, email: true } },
      attachments: { orderBy: { id: 'asc' } },
    },
  })
  return interactions.map(withUser)
})
