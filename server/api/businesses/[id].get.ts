import { getDb } from '../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  const business = db.prepare(`
    SELECT b.*, u.username as assigned_username, u.email as assigned_email
    FROM businesses b
    LEFT JOIN users u ON b.assigned_to = u.id
    WHERE b.id = ?
  `).get(id)

  if (!business) throw createError({ statusCode: 404, message: 'Business not found' })
  return business
})
