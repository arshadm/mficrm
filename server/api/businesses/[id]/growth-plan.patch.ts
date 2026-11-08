import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { sanitizeRichText } from '../../../utils/html'
import { GrowthPlanSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = GrowthPlanSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  const data = {
    year1_goals: sanitizeRichText(d.year1_goals ?? null),
    year2_goals: sanitizeRichText(d.year2_goals ?? null),
    marketing_strategy: sanitizeRichText(d.marketing_strategy ?? null),
    product_roadmap: sanitizeRichText(d.product_roadmap ?? null),
    team_requirements: d.team_requirements ?? null, // plain text (textarea), never rendered as HTML
  }
  return orNotFound(
    prisma.growthPlan.upsert({ where: { business_id }, create: { business_id, ...data }, update: data }),
    'Business not found',
  )
})
