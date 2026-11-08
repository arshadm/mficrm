import type { H3Event } from 'h3'
import { rateLimit } from './rateLimit'

// Each Claude request costs money: a per-user ceiling guards against loops and runaway clicking. Returns the
// logged-in user.
export async function aiRateLimit(event: H3Event) {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const user = session.user
  rateLimit(event, `ai:user:${user.id}`, 60, 60 * 60 * 1000, 'AI request limit reached (60 an hour). Try again later.')
  return user
}
