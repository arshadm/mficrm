import { getDb } from '../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  const existing = db.prepare('SELECT id FROM businesses WHERE id = ?').get(id)
  if (!existing) throw createError({ statusCode: 404, message: 'Business not found' })

  db.prepare('DELETE FROM businesses WHERE id = ?').run(id)
  return { success: true }
})
