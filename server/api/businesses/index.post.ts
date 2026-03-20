import { getDb } from '../../db/database'
import { CreateBusinessSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const parsed = CreateBusinessSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data

  const result = db.prepare(`
    INSERT INTO businesses (name, category, stage, description, listing_url, asking_price,
    trailing_12m_revenue, trailing_12m_profit, platform, date_listed, assigned_to,
    follow_up_date, follow_up_note, date_added, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    d.name, d.category, d.stage, d.description ?? null, d.listing_url || null,
    d.asking_price ?? null, d.trailing_12m_revenue ?? null, d.trailing_12m_profit ?? null,
    d.platform ?? null, d.date_listed ?? null, d.assigned_to ?? null,
    d.follow_up_date ?? null, d.follow_up_note ?? null, now, now
  )

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(result.lastInsertRowid)
  return business
})
