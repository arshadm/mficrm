import { getDb } from '../../../db/database'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1).optional(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['pending', 'done', 'skipped']).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const subtaskId = getRouterParam(event, 'subtaskId')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data
  const fields: string[] = ['updated_at = ?']
  const values: (string | null)[] = [now]

  if (d.title !== undefined) { fields.push('title = ?'); values.push(d.title) }
  if (d.due_date !== undefined) { fields.push('due_date = ?'); values.push(d.due_date ?? null) }
  if (d.status !== undefined) {
    fields.push('status = ?')
    values.push(d.status)
    if (d.status === 'done') {
      fields.push('completed_at = ?')
      values.push(now)
    }
  }

  values.push(subtaskId as string)
  db.prepare(`UPDATE next_steps SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return db.prepare('SELECT * FROM next_steps WHERE id = ?').get(subtaskId)
})
