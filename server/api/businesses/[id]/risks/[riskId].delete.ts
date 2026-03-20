import { getDb } from '../../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const riskId = getRouterParam(event, 'riskId')
  const db = getDb()

  db.prepare('DELETE FROM risk_checklist WHERE id = ?').run(riskId)
  return { success: true }
})
