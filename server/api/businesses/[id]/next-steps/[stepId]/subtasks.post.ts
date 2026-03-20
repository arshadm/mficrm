import { getDb } from '../../../../../db/database'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1),
  due_date: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const stepId = getRouterParam(event, 'stepId')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data

  const result = db.prepare(`
    INSERT INTO next_steps (business_id, title, due_date, is_primary, parent_id, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, 0, ?, 'pending', ?, ?, ?)
  `).run(id, d.title, d.due_date ?? now.split('T')[0], stepId, session.user.id, now, now)

  return db.prepare('SELECT * FROM next_steps WHERE id = ?').get(result.lastInsertRowid)
})
