import { getDb } from '../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  const actions = db.prepare(`
    SELECT ns.id as step_id, ns.title as step_title, ns.notes as step_notes,
           ns.due_date, ns.status,
           b.id as business_id, b.name as business_name, b.category as business_category
    FROM next_steps ns
    JOIN businesses b ON ns.business_id = b.id
    WHERE ns.is_primary = 1 AND ns.status = 'pending'
      AND ns.due_date <= ?
      AND b.is_archived = 0
    ORDER BY ns.due_date ASC
  `).all(today)

  return actions
})
