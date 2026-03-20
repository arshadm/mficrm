import { getDb } from '../../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  // Primary pending step
  const primary = db.prepare(`
    SELECT ns.*, u.username as completed_by_username, c.username as created_by_username
    FROM next_steps ns
    LEFT JOIN users u ON ns.completed_by = u.id
    LEFT JOIN users c ON ns.created_by = c.id
    WHERE ns.business_id = ? AND ns.is_primary = 1 AND ns.status = 'pending'
    ORDER BY ns.created_at ASC LIMIT 1
  `).get(id) as Record<string, unknown> | undefined

  // Sub-tasks of the active primary step
  const subtasks = primary
    ? db.prepare(`
        SELECT * FROM next_steps
        WHERE parent_id = ? AND is_primary = 0
        ORDER BY created_at ASC
      `).all(primary['id'] as number)
    : []

  // History: all non-pending primaries
  const history = db.prepare(`
    SELECT ns.*, u.username as completed_by_username
    FROM next_steps ns
    LEFT JOIN users u ON ns.completed_by = u.id
    WHERE ns.business_id = ? AND ns.is_primary = 1 AND ns.status != 'pending'
    ORDER BY ns.completed_at DESC
  `).all(id)

  return { primary: primary || null, subtasks, history }
})
