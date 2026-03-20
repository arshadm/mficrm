import { getDb } from '../../../../db/database'
import { RiskItemSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const riskId = getRouterParam(event, 'riskId')
  const body = await readBody(event)
  const parsed = RiskItemSchema.partial().safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const d = parsed.data
  const fields: string[] = []
  const values: (string | number | null)[] = []

  if (d.description !== undefined) { fields.push('description = ?'); values.push(d.description) }
  if (d.category !== undefined) { fields.push('category = ?'); values.push(d.category) }
  if (d.is_resolved !== undefined) { fields.push('is_resolved = ?'); values.push(d.is_resolved ? 1 : 0) }
  if (d.resolved_note !== undefined) { fields.push('resolved_note = ?'); values.push(d.resolved_note ?? null) }

  if (!fields.length) return db.prepare('SELECT * FROM risk_checklist WHERE id = ?').get(riskId)

  values.push(riskId as string)
  db.prepare(`UPDATE risk_checklist SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return db.prepare('SELECT * FROM risk_checklist WHERE id = ?').get(riskId)
})
