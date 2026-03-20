import { getDb } from '../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  let record = db.prepare('SELECT * FROM growth_plan WHERE business_id = ?').get(id)
  if (!record) {
    db.prepare('INSERT INTO growth_plan (business_id) VALUES (?)').run(id)
    record = db.prepare('SELECT * FROM growth_plan WHERE business_id = ?').get(id)
  }
  return record
})
