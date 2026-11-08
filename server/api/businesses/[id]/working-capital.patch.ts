import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { WorkingCapitalSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = WorkingCapitalSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  const total = [
    d.acquisition_cost, d.legal_fees, d.transition_costs,
    d.initial_marketing_budget, d.tech_infrastructure,
    d.working_capital_buffer, d.other_costs,
  ].reduce<number>((sum, v) => sum + (v || 0), 0)

  const data = {
    acquisition_cost: d.acquisition_cost ?? null,
    legal_fees: d.legal_fees ?? null,
    transition_costs: d.transition_costs ?? null,
    initial_marketing_budget: d.initial_marketing_budget ?? null,
    tech_infrastructure: d.tech_infrastructure ?? null,
    working_capital_buffer: d.working_capital_buffer ?? null,
    other_costs: d.other_costs ?? null,
    other_costs_notes: d.other_costs_notes ?? null,
    total_estimated: total,
    funding_source: d.funding_source ?? null,
  }
  return orNotFound(
    prisma.workingCapital.upsert({ where: { business_id }, create: { business_id, ...data }, update: data }),
    'Business not found',
  )
})
