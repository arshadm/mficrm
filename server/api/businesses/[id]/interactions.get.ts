import { getDb } from '../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  const interactions = db.prepare(`
    SELECT i.*, u.username, u.email as user_email
    FROM interactions i
    LEFT JOIN users u ON i.user_id = u.id
    WHERE i.business_id = ?
    ORDER BY i.occurred_at DESC
  `).all(id) as Array<Record<string, unknown>>

  // Attach files
  for (const interaction of interactions) {
    const attachments = db.prepare(
      'SELECT * FROM attachments WHERE interaction_id = ?'
    ).all(interaction['id'] as number)
    interaction['attachments'] = attachments
  }

  return interactions
})
