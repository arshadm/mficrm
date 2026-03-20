import { getDb } from '../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const db = getDb()

  const total = (db.prepare('SELECT COUNT(*) as c FROM businesses WHERE is_archived = 0').get() as { c: number }).c

  const byStage = db.prepare(`
    SELECT stage, COUNT(*) as count FROM businesses WHERE is_archived = 0 GROUP BY stage
  `).all() as { stage: string, count: number }[]

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count FROM businesses WHERE is_archived = 0 GROUP BY category
  `).all() as { category: string, count: number }[]

  const totalAskingPrice = (db.prepare(`
    SELECT COALESCE(SUM(asking_price), 0) as total FROM businesses WHERE is_archived = 0 AND asking_price IS NOT NULL
  `).get() as { total: number }).total

  const totalMidValue = (db.prepare(`
    SELECT COALESCE(SUM(v.estimated_value_mid), 0) as total
    FROM valuation v
    JOIN businesses b ON v.business_id = b.id
    WHERE b.is_archived = 0
  `).get() as { total: number }).total

  const today = new Date().toISOString().split('T')[0]
  const followUps = db.prepare(`
    SELECT b.id, b.name, b.stage, b.follow_up_date, b.follow_up_note
    FROM businesses b
    WHERE b.follow_up_date <= ? AND b.is_archived = 0
    ORDER BY b.follow_up_date ASC
  `).all(today) as { id: number, name: string, stage: string, follow_up_date: string, follow_up_note: string | null }[]

  const recentInteractions = db.prepare(`
    SELECT i.*, b.name as business_name, u.username
    FROM interactions i
    JOIN businesses b ON i.business_id = b.id
    LEFT JOIN users u ON i.user_id = u.id
    ORDER BY i.created_at DESC
    LIMIT 5
  `).all() as Array<Record<string, unknown>>

  return {
    total,
    byStage,
    byCategory,
    totalAskingPrice,
    totalMidValue,
    followUps,
    recentInteractions,
  }
})
