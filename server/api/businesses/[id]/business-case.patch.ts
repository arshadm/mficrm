import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { sanitizeRichText } from '../../../utils/html'
import { BusinessCaseSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = BusinessCaseSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })
  }

  const d = parsed.data
  const data = {
    strategic_rationale: sanitizeRichText(d.strategic_rationale ?? null),
    target_market: sanitizeRichText(d.target_market ?? null),
    competitive_advantage: sanitizeRichText(d.competitive_advantage ?? null),
    key_risks: sanitizeRichText(d.key_risks ?? null),
    assumptions: sanitizeRichText(d.assumptions ?? null),
  }
  return orNotFound(
    prisma.businessCase.upsert({ where: { business_id }, create: { business_id, ...data }, update: data }),
    'Business not found',
  )
})
