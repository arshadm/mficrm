import { idParam, prisma } from '../../../../db/prisma'

// The stored AI summary, if any
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const row = await prisma.business.findUnique({ where: { id: idParam(event, 'id') }, select: { ai_summary: true, ai_summary_at: true } })
  if (!row) throw createError({ statusCode: 404, message: 'Business not found' })
  let summary = null
  try {
    summary = row.ai_summary ? JSON.parse(row.ai_summary) : null
  } catch {}
  return { summary, ai_summary_at: row.ai_summary_at }
})
