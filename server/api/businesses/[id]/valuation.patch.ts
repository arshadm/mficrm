import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { ValuationSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = ValuationSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  const data = {
    valuation_method: d.valuation_method ?? null,
    estimated_value_low: d.estimated_value_low ?? null,
    estimated_value_mid: d.estimated_value_mid ?? null,
    estimated_value_high: d.estimated_value_high ?? null,
    initial_offer: d.initial_offer ?? null,
    max_offer: d.max_offer ?? null,
    final_offer_made: d.final_offer_made ?? null,
    offer_notes: d.offer_notes ?? null,
  }
  return orNotFound(
    prisma.valuation.upsert({ where: { business_id }, create: { business_id, ...data }, update: data }),
    'Business not found',
  )
})
