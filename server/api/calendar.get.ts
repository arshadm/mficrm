import { getDb } from '../db/database'

interface CalendarEntry {
  id: number
  step_id: number
  step_title: string
  step_notes: string | null
  due_date: string
  business_name: string
  business_category: string
  business_id: number
  is_overdue: boolean
}

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const from = (query.from as string) || new Date().toISOString().split('T')[0]
  const to = (query.to as string) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const db = getDb()

  // Steps in range (non-overdue)
  const inRange = db.prepare(`
    SELECT ns.id as step_id, ns.title as step_title, ns.notes as step_notes,
           ns.due_date, b.id as business_id, b.name as business_name, b.category as business_category
    FROM next_steps ns
    JOIN businesses b ON ns.business_id = b.id
    WHERE ns.is_primary = 1 AND ns.status = 'pending'
      AND ns.due_date >= ? AND ns.due_date <= ?
      AND b.is_archived = 0
    ORDER BY ns.due_date ASC
  `).all(from, to) as CalendarEntry[]

  // Overdue steps (due before today, still pending)
  const overdue = db.prepare(`
    SELECT ns.id as step_id, ns.title as step_title, ns.notes as step_notes,
           ns.due_date, b.id as business_id, b.name as business_name, b.category as business_category
    FROM next_steps ns
    JOIN businesses b ON ns.business_id = b.id
    WHERE ns.is_primary = 1 AND ns.status = 'pending'
      AND ns.due_date < ?
      AND b.is_archived = 0
    ORDER BY ns.due_date ASC
  `).all(today) as CalendarEntry[]

  // Group by date; overdue items go under today
  const result: Record<string, CalendarEntry[]> = {}

  for (const item of inRange) {
    const key = item.due_date
    if (!result[key]) result[key] = []
    result[key].push({ ...item, is_overdue: false })
  }

  if (overdue.length) {
    if (!result[today]) result[today] = []
    for (const item of overdue) {
      result[today].push({ ...item, is_overdue: true })
    }
  }

  return result
})
