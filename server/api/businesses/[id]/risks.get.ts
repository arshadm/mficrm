import { getDb } from '../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  return db.prepare('SELECT * FROM risk_checklist WHERE business_id = ? ORDER BY created_at ASC').all(id)
})
