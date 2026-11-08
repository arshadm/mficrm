import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { RiskItemSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = RiskItemSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  return orNotFound(
    prisma.riskItem.create({
      data: {
        business_id,
        category: d.category,
        description: d.description,
        is_resolved: !!d.is_resolved,
        resolved_note: d.resolved_note ?? null,
      },
    }),
    'Business not found',
  )
})
