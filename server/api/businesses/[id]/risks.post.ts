import { getDb } from '../../../db/database'
import { RiskItemSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = RiskItemSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data

  const result = db.prepare(`
    INSERT INTO risk_checklist (business_id, category, description, is_resolved, resolved_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, d.category, d.description, d.is_resolved ? 1 : 0, d.resolved_note ?? null, now)

  return db.prepare('SELECT * FROM risk_checklist WHERE id = ?').get(result.lastInsertRowid)
})
