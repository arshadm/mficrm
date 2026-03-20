import { getDb } from '../../../db/database'
import { GrowthPlanSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = GrowthPlanSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()

  const existing = db.prepare('SELECT id FROM growth_plan WHERE business_id = ?').get(id)
  if (!existing) db.prepare('INSERT INTO growth_plan (business_id) VALUES (?)').run(id)

  const d = parsed.data
  db.prepare(`
    UPDATE growth_plan SET
      year1_goals = ?, year2_goals = ?, marketing_strategy = ?,
      product_roadmap = ?, team_requirements = ?, updated_at = ?
    WHERE business_id = ?
  `).run(d.year1_goals ?? null, d.year2_goals ?? null, d.marketing_strategy ?? null,
    d.product_roadmap ?? null, d.team_requirements ?? null, now, id)

  return db.prepare('SELECT * FROM growth_plan WHERE business_id = ?').get(id)
})
