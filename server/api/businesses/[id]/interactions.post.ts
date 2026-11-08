import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { sanitizeRichText } from '../../../utils/html'
import { withUser } from '../../../utils/rows'
import { CreateInteractionSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = CreateInteractionSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  const now = new Date()
  const occurred = d.occurred_at ? new Date(d.occurred_at) : now
  if (Number.isNaN(occurred.getTime())) throw createError({ statusCode: 400, message: 'Invalid occurred_at' })

  const [interaction] = await orNotFound(prisma.$transaction([
    prisma.interaction.create({
      data: {
        business_id,
        user_id: session.user.id,
        type: d.type,
        title: d.title ?? null,
        body: sanitizeRichText(d.body ?? null),
        occurred_at: occurred,
        created_at: now,
      },
      include: { user: { select: { username: true, email: true } } },
    }),
    prisma.business.update({ where: { id: business_id }, data: { last_updated: now }, select: { id: true } }),
  ]), 'Business not found')

  return withUser(interaction)
})
