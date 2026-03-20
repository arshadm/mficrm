import { getDb } from '../../../db/database'
import { ValuationSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = ValuationSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data

  const existing = db.prepare('SELECT id FROM valuation WHERE business_id = ?').get(id)
  if (!existing) db.prepare('INSERT INTO valuation (business_id) VALUES (?)').run(id)

  db.prepare(`
    UPDATE valuation SET
      valuation_method = ?, estimated_value_low = ?, estimated_value_mid = ?,
      estimated_value_high = ?, initial_offer = ?, max_offer = ?,
      final_offer_made = ?, offer_notes = ?, updated_at = ?
    WHERE business_id = ?
  `).run(
    d.valuation_method ?? null, d.estimated_value_low ?? null, d.estimated_value_mid ?? null,
    d.estimated_value_high ?? null, d.initial_offer ?? null, d.max_offer ?? null,
    d.final_offer_made ?? null, d.offer_notes ?? null, now, id
  )

  return db.prepare('SELECT * FROM valuation WHERE business_id = ?').get(id)
})
