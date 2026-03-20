import { getDb } from '../../../db/database'
import { CreateInteractionSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const parsed = CreateInteractionSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const now = new Date().toISOString()
  const d = parsed.data

  const result = db.prepare(`
    INSERT INTO interactions (business_id, user_id, type, title, body, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, session.user.id, d.type, d.title ?? null, d.body ?? null, d.occurred_at || now, now)

  // Update business last_updated
  db.prepare('UPDATE businesses SET last_updated = ? WHERE id = ?').run(now, id)

  const interaction = db.prepare(`
    SELECT i.*, u.username, u.email as user_email
    FROM interactions i
    LEFT JOIN users u ON i.user_id = u.id
    WHERE i.id = ?
  `).get(result.lastInsertRowid)

  return interaction
})
