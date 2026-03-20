import { getDb } from '../../../db/database'
import { WorkingCapitalSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = WorkingCapitalSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data

  const total = [
    d.acquisition_cost, d.legal_fees, d.transition_costs,
    d.initial_marketing_budget, d.tech_infrastructure,
    d.working_capital_buffer, d.other_costs
  ].reduce((sum, v) => sum + (v || 0), 0)

  const existing = db.prepare('SELECT id FROM working_capital WHERE business_id = ?').get(id)
  if (!existing) db.prepare('INSERT INTO working_capital (business_id) VALUES (?)').run(id)

  db.prepare(`
    UPDATE working_capital SET
      acquisition_cost = ?, legal_fees = ?, transition_costs = ?,
      initial_marketing_budget = ?, tech_infrastructure = ?,
      working_capital_buffer = ?, other_costs = ?, other_costs_notes = ?,
      total_estimated = ?, funding_source = ?, updated_at = ?
    WHERE business_id = ?
  `).run(
    d.acquisition_cost ?? null, d.legal_fees ?? null, d.transition_costs ?? null,
    d.initial_marketing_budget ?? null, d.tech_infrastructure ?? null,
    d.working_capital_buffer ?? null, d.other_costs ?? null, d.other_costs_notes ?? null,
    total, d.funding_source ?? null, now, id
  )

  return db.prepare('SELECT * FROM working_capital WHERE business_id = ?').get(id)
})
