import { getDb } from '../../../../../db/database'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const stepId = getRouterParam(event, 'stepId')
  const body = await readBody(event)
  const { completion_note } = z.object({ completion_note: z.string().optional() }).parse(body)

  const db = getDb()
  const now = new Date().toISOString()

  const step = db.prepare('SELECT * FROM next_steps WHERE id = ?').get(stepId) as { title: string } | undefined
  if (!step) throw createError({ statusCode: 404, message: 'Step not found' })

  db.prepare(`
    UPDATE next_steps SET
      status = 'done', completed_at = ?, completed_by = ?,
      completion_note = ?, updated_at = ?
    WHERE id = ?
  `).run(now, session.user.id, completion_note ?? null, now, stepId)

  // Log interaction
  db.prepare(`
    INSERT INTO interactions (business_id, user_id, type, title, body, occurred_at, created_at)
    VALUES (?, ?, 'note', ?, ?, ?, ?)
  `).run(
    id, session.user.id,
    `Next step completed: ${step.title}`,
    completion_note ? `<p>${completion_note}</p>` : '<p>Next step marked as completed.</p>',
    now, now
  )

  db.prepare('UPDATE businesses SET last_updated = ? WHERE id = ?').run(now, id)

  return db.prepare('SELECT * FROM next_steps WHERE id = ?').get(stepId)
})
