import type { H3Event } from 'h3'

// General fixed-window rate limiter, in memory (production runs one container, like loginRateLimit.ts). Used by
// the public form endpoints, which anyone can reach.

interface Bucket { count: number, resetAt: number }
const buckets = new Map<string, Bucket>()
const MAX_ENTRIES = 20_000

/**
 * Counts one hit on `key` and throws 429 (with Retry-After) once it exceeds `limit` within `windowMs`.
 */
export function rateLimit(event: H3Event, key: string, limit: number, windowMs: number, message = 'Too many requests. Try again later.') {
  const now = Date.now()
  if (buckets.size >= MAX_ENTRIES) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    for (const k of buckets.keys()) {
      if (buckets.size < MAX_ENTRIES) break
      buckets.delete(k)
    }
  }
  let b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count++
  if (b.count > limit) {
    setResponseHeader(event, 'Retry-After', Math.ceil((b.resetAt - now) / 1000))
    throw createError({ statusCode: 429, message })
  }
}
