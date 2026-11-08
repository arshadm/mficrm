import { toDate, today } from '../db/prisma'
import { pendingPrimarySteps } from '../utils/dueSteps'

type Step = Awaited<ReturnType<typeof pendingPrimarySteps>>[number]
type CalendarEntry = Omit<Step, 'status'> & { is_overdue: boolean }

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const todayStr = new Date().toISOString().slice(0, 10)
  const from = (query.from as string) || todayStr
  const to = (query.to as string) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  // Steps in range, and overdue steps (due before today, still pending)
  const [inRange, overdue] = await Promise.all([
    pendingPrimarySteps({ gte: toDate(from)!, lte: toDate(to)! }),
    pendingPrimarySteps({ lt: today() }),
  ])

  // Group by date; overdue items go under today
  const result: Record<string, CalendarEntry[]> = {}

  for (const { status: _, ...item } of inRange) {
    const key = item.due_date
    if (!result[key]) result[key] = []
    result[key].push({ ...item, is_overdue: false })
  }

  if (overdue.length) {
    if (!result[todayStr]) result[todayStr] = []
    for (const { status: _, ...item } of overdue) {
      result[todayStr].push({ ...item, is_overdue: true })
    }
  }

  return result
})
