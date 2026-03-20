import { getDb } from '../../../db/database'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1),
  notes: z.string().optional().nullable(),
  due_date: z.string().min(1, 'Due date is required'),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })

  const db = getDb()

  // Enforce: only one pending primary step per business
  const existing = db.prepare(`
    SELECT id FROM next_steps
    WHERE business_id = ? AND is_primary = 1 AND status = 'pending'
  `).get(id)

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'This business already has an active primary next step. Complete or skip it before adding a new one.',
    })
  }

  const now = new Date().toISOString()
  const d = parsed.data

  const result = db.prepare(`
    INSERT INTO next_steps (business_id, title, notes, due_date, is_primary, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?)
  `).run(id, d.title, d.notes ?? null, d.due_date, session.user.id, now, now)

  return db.prepare('SELECT * FROM next_steps WHERE id = ?').get(result.lastInsertRowid)
})
