import { getDb } from '../../../../db/database'
import Papa from 'papaparse'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!business) throw createError({ statusCode: 404, message: 'Not found' })

  const activeStep = db.prepare(
    `SELECT title, due_date FROM next_steps WHERE business_id = ? AND is_primary = 1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`
  ).get(id) as { title: string, due_date: string } | undefined

  const row = {
    ...business,
    next_step_title: activeStep?.title ?? null,
    next_step_due_date: activeStep?.due_date ?? null,
  }

  const csv = Papa.unparse([row])

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="business-${id}.csv"`)
  return csv
})
