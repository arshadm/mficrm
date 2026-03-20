import { getDb } from '../../../db/database'
import Papa from 'papaparse'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const db = getDb()

  let sql = `
    SELECT b.id, b.name, b.category, b.stage, b.platform, b.asking_price,
    b.trailing_12m_revenue, b.trailing_12m_profit, b.follow_up_date,
    b.date_added, b.last_updated, u.username as assigned_to,
    ns.title as next_step_title, ns.due_date as next_step_due_date
    FROM businesses b
    LEFT JOIN users u ON b.assigned_to = u.id
    LEFT JOIN next_steps ns ON ns.id = (
      SELECT id FROM next_steps
      WHERE business_id = b.id AND is_primary = 1 AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    )
    WHERE b.is_archived = 0
  `
  const params: (string | number)[] = []

  if (query.stage) { sql += ' AND b.stage = ?'; params.push(query.stage as string) }
  if (query.category) { sql += ' AND b.category = ?'; params.push(query.category as string) }

  const businesses = db.prepare(sql).all(...params)
  const csv = Papa.unparse(businesses as object[])

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', 'attachment; filename="businesses.csv"')
  return csv
})
