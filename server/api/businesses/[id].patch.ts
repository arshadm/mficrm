import { getDb } from '../../db/database'
import { UpdateBusinessSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = UpdateBusinessSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })
  }

  const db = getDb()
  const existing = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id) as { stage: string } | undefined
  if (!existing) throw createError({ statusCode: 404, message: 'Business not found' })

  const d = parsed.data
  const now = new Date().toISOString()

  // Log stage change if stage changed
  if (d.stage && d.stage !== existing.stage) {
    db.prepare(`
      INSERT INTO interactions (business_id, user_id, type, title, body, occurred_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, session.user.id, 'stage_change',
      'Stage Changed',
      `<p>Stage changed from <strong>${existing.stage.replace(/_/g, ' ')}</strong> to <strong>${d.stage.replace(/_/g, ' ')}</strong>.</p>`,
      now, now
    )
  }

  // Build dynamic update
  const fields: string[] = []
  const values: (string | number | null)[] = []

  const fieldMap: Record<string, string | number | null | undefined> = {
    name: d.name,
    category: d.category,
    stage: d.stage,
    description: d.description,
    listing_url: d.listing_url || null,
    asking_price: d.asking_price,
    trailing_12m_revenue: d.trailing_12m_revenue,
    trailing_12m_profit: d.trailing_12m_profit,
    platform: d.platform,
    date_listed: d.date_listed,
    assigned_to: d.assigned_to,
    follow_up_date: d.follow_up_date,
    follow_up_note: d.follow_up_note,
  }

  for (const [key, val] of Object.entries(fieldMap)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(val as string | number | null)
    }
  }

  fields.push('last_updated = ?')
  values.push(now)
  values.push(id as string)

  db.prepare(`UPDATE businesses SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return db.prepare('SELECT * FROM businesses WHERE id = ?').get(id)
})
