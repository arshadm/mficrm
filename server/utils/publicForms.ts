import type { H3Event } from 'h3'
import { prisma } from '../db/prisma'
import { effectiveStatus, hashFormToken } from './formRequests'
import { clientIp } from './loginRateLimit'
import { rateLimit } from './rateLimit'
import type { FormSchema } from '~/shared/forms'

// Shared by the public form endpoints (/api/public/forms/[token]), which are reachable without a login and
// authorised only by the link token. They return nothing from the CRM beyond the form itself.

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const WINDOW = 15 * 60 * 1000

export const PUBLIC_LIMITS = {
  viewsPerIp: 120,
  notFoundPerIp: 20,
  submitsPerIp: 20,
  submitsPerToken: 10,
  /** Whole multipart submission, all files included */
  submissionBytes: 50 * 1024 * 1024,
}

export type LinkProblem = 'expired' | 'revoked' | 'submitted'

const LINK_MESSAGES: Record<LinkProblem, string> = {
  expired: 'This link has expired. Please ask the sender for a new one.',
  revoked: 'This link is no longer active. Please ask the sender for a new one.',
  submitted: 'This form has already been submitted. Thank you.',
}

/** Loads the link for a token. 404 for malformed or unknown tokens (rate-limited per IP to stop scanning). */
export async function findLink(event: H3Event) {
  const ip = clientIp(event)
  rateLimit(event, `pub:view:${ip}`, PUBLIC_LIMITS.viewsPerIp, WINDOW)
  const token = getRouterParam(event, 'token') || ''

  const link = TOKEN_RE.test(token)
    ? await prisma.formRequest.findUnique({
        where: { token_hash: hashFormToken(token) },
        select: {
          id: true, status: true, expires_at: true, business_id: true, token_hash: true, recipient_name: true, recipient_email: true,
          form: { select: { name: true, description: true } },
          form_version: { select: { schema: true } },
        },
      })
    : null

  if (!link) {
    rateLimit(event, `pub:404:${ip}`, PUBLIC_LIMITS.notFoundPerIp, WINDOW)
    throw createError({ statusCode: 404, message: 'Form not found' })
  }
  return { ...link, schema: link.form_version.schema as unknown as FormSchema }
}

/** 410 with a readable reason when the link can no longer be used. */
export function assertUsable(link: { status: string, expires_at: Date }) {
  const status = effectiveStatus(link)
  if (status === 'expired' || status === 'revoked' || status === 'submitted') {
    throw createError({ statusCode: 410, message: LINK_MESSAGES[status], data: { reason: status } })
  }
}

export function noStore(event: H3Event) {
  setResponseHeader(event, 'Cache-Control', 'no-store')
}
