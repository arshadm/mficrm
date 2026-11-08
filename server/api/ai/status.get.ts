import { claudeStatus } from '../../utils/ai'

// Whether AI assistance is available (the Claude CLI is installed and signed in). `?refresh=1` checks again now
// (Settings → Claude); the login command is shown to admins only.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const status = await claudeStatus(getQuery(event).refresh === '1')
  if (session.user.role !== 'admin') return { configured: status.configured, model: status.model, reason: status.reason }
  return status
})
