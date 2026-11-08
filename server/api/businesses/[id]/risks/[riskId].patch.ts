import { idParam, orNotFound, prisma } from '../../../../db/prisma'
import { RiskItemSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'riskId')
  const body = await readBody(event)
  const parsed = RiskItemSchema.partial().safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  return orNotFound(prisma.riskItem.update({
    where: { id },
    data: {
      description: d.description,
      category: d.category,
      is_resolved: d.is_resolved === undefined ? undefined : !!d.is_resolved,
      resolved_note: d.resolved_note === undefined ? undefined : d.resolved_note ?? null,
    },
  }), 'Risk not found')
})
