import type { H3Event } from 'h3'

// Throttles failed logins, in memory. That's enough because production runs a single container (config/deploy.yml),
// and a restart clearing the counters is acceptable.
//
// Failures are counted per client IP and per username in fixed windows. Once either key reaches its limit, every
// attempt on it (even with the right password) gets 429 until the window ends. A successful login clears the
// username's counter.

const WINDOW_MS = 15 * 60 * 1000
// Per username: stops guessing one account's password from many IPs
const MAX_FAILURES_PER_USERNAME = 5
// Per IP: stops one client trying many usernames. Higher, since an office may share one address.
const MAX_FAILURES_PER_IP = 20
const MAX_ENTRIES = 10_000

interface Bucket { failures: number, resetAt: number }
const buckets = new Map<string, Bucket>()

function prune(now: number) {
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key)
  // Still too many (a flood of distinct keys): drop the oldest, which Map iteration yields first
  for (const key of buckets.keys()) {
    if (buckets.size <= MAX_ENTRIES) break
    buckets.delete(key)
  }
}

function live(key: string, now: number): Bucket | undefined {
  const b = buckets.get(key)
  if (b && b.resetAt <= now) {
    buckets.delete(key)
    return undefined
  }
  return b
}

/**
 * The client's IP. Behind Cloudflare and kamal-proxy the socket address is the proxy's, so production sets
 * TRUSTED_IP_HEADER=cf-connecting-ip (config/deploy.yml). Only trust that header when the firewall lets nothing
 * but Cloudflare reach the server, or clients could set it themselves.
 */
export function clientIp(event: H3Event): string {
  const header = process.env.TRUSTED_IP_HEADER
  if (header) {
    const value = getRequestHeader(event, header)?.split(',')[0]?.trim()
    if (value) return value
  }
  return getRequestIP(event) || 'unknown'
}

function keys(ip: string, username: string) {
  return { ipKey: `ip:${ip}`, userKey: `user:${username.trim().toLowerCase()}` }
}

/** Throws 429 (with Retry-After) when this IP or username is locked out. Call before checking the password. */
export function assertLoginAllowed(event: H3Event, username: string) {
  const now = Date.now()
  const { ipKey, userKey } = keys(clientIp(event), username)
  const locked = [
    [live(ipKey, now), MAX_FAILURES_PER_IP],
    [live(userKey, now), MAX_FAILURES_PER_USERNAME],
  ] as const
  const resetAt = Math.max(0, ...locked.filter(([b, max]) => b && b.failures >= max).map(([b]) => b!.resetAt))
  if (resetAt) {
    const retryAfter = Math.ceil((resetAt - now) / 1000)
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, message: 'Too many failed login attempts. Try again later.' })
  }
}

export function recordLoginFailure(event: H3Event, username: string) {
  const now = Date.now()
  if (buckets.size >= MAX_ENTRIES) prune(now)
  for (const key of Object.values(keys(clientIp(event), username))) {
    const b = live(key, now)
    if (b) b.failures++
    else buckets.set(key, { failures: 1, resetAt: now + WINDOW_MS })
  }
}

export function recordLoginSuccess(event: H3Event, username: string) {
  buckets.delete(keys(clientIp(event), username).userKey)
}
