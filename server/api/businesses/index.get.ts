import { getDb } from '../../db/database'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const db = getDb()

  let sql = `
    SELECT b.*, u.username as assigned_username, u.email as assigned_email
    FROM businesses b
    LEFT JOIN users u ON b.assigned_to = u.id
    WHERE 1=1
  `
  const params: (string | number)[] = []

  if (query.stage) { sql += ' AND b.stage = ?'; params.push(query.stage as string) }
  if (query.category) { sql += ' AND b.category = ?'; params.push(query.category as string) }
  if (query.platform) { sql += ' AND b.platform = ?'; params.push(query.platform as string) }
  if (query.assigned_to) { sql += ' AND b.assigned_to = ?'; params.push(Number(query.assigned_to)) }
  if (query.search) {
    sql += ' AND (b.name LIKE ? OR b.description LIKE ? OR b.platform LIKE ?)'
    const s = `%${query.search}%`
    params.push(s, s, s)
  }
  if (query.archived === '1') {
    sql += ' AND b.is_archived = 1'
  } else {
    sql += ' AND b.is_archived = 0'
  }
  if (query.date_from) { sql += ' AND b.date_added >= ?'; params.push(query.date_from as string) }
  if (query.date_to) { sql += ' AND b.date_added <= ?'; params.push(query.date_to as string) }

  const sortBy = (query.sort_by as string) || 'last_updated'
  const sortDir = (query.sort_dir as string) === 'asc' ? 'ASC' : 'DESC'
  const allowedSorts = ['name', 'asking_price', 'trailing_12m_profit', 'last_updated', 'date_added', 'follow_up_date', 'stage']
  if (allowedSorts.includes(sortBy)) {
    sql += ` ORDER BY b.${sortBy} ${sortDir}`
  } else {
    sql += ' ORDER BY b.last_updated DESC'
  }

  const businesses = db.prepare(sql).all(...params)
  return businesses
})
