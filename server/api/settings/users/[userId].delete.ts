import { getDb } from '../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  const userId = getRouterParam(event, 'userId')
  const db = getDb()

  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  return { success: true }
})
