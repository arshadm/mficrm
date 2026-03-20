import { getDb } from '../../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const interactionId = getRouterParam(event, 'interactionId')
  const db = getDb()

  db.prepare('DELETE FROM interactions WHERE id = ?').run(interactionId)
  return { success: true }
})
