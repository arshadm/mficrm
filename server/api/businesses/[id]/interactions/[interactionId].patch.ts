import { idParam, orNotFound, prisma } from '../../../../db/prisma'
import { sanitizeRichText } from '../../../../utils/html'
import { CreateInteractionSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'interactionId')
  const body = await readBody(event)
  const parsed = CreateInteractionSchema.partial().safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  let occurred: Date | undefined
  if (d.occurred_at !== undefined) {
    occurred = new Date(d.occurred_at)
    if (Number.isNaN(occurred.getTime())) throw createError({ statusCode: 400, message: 'Invalid occurred_at' })
  }

  return orNotFound(prisma.interaction.update({
    where: { id },
    data: {
      type: d.type,
      title: d.title === undefined ? undefined : d.title ?? null,
      body: d.body === undefined ? undefined : sanitizeRichText(d.body ?? null),
      occurred_at: occurred,
    },
  }), 'Interaction not found')
})
