import { getDb } from '../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const stepId = getRouterParam(event, 'stepId')
  const db = getDb()
  const now = new Date().toISOString()

  // Soft delete: set status = 'skipped'
  db.prepare(`UPDATE next_steps SET status = 'skipped', updated_at = ? WHERE id = ?`).run(now, stepId)
  return { success: true }
})
