import { getDb } from '../../../db/database'
import { BusinessCaseSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = BusinessCaseSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })
  }

  const db = getDb()
  const now = new Date().toISOString()

  const existing = db.prepare('SELECT id FROM business_case WHERE business_id = ?').get(id)
  if (!existing) {
    db.prepare('INSERT INTO business_case (business_id) VALUES (?)').run(id)
  }

  const d = parsed.data
  db.prepare(`
    UPDATE business_case SET
      strategic_rationale = ?, target_market = ?, competitive_advantage = ?,
      key_risks = ?, assumptions = ?, updated_at = ?
    WHERE business_id = ?
  `).run(
    d.strategic_rationale ?? null, d.target_market ?? null,
    d.competitive_advantage ?? null, d.key_risks ?? null,
    d.assumptions ?? null, now, id
  )

  return db.prepare('SELECT * FROM business_case WHERE business_id = ?').get(id)
})
