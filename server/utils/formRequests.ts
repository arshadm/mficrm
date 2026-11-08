import { createHash, randomBytes } from 'crypto'
import type { H3Event } from 'h3'

// Form links (mficrm-xln.4). The token is 256 random bits, base64url-encoded; only its SHA-256 hash is stored, so a
// database leak doesn't expose working links. The raw token is returned once, when the link is created.

export function newFormToken(): { token: string, hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashFormToken(token) }
}

export function hashFormToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Public URL of a link. APP_URL in production; the request's own origin otherwise. */
export function formLinkUrl(event: H3Event, token: string): string {
  const base = (process.env.APP_URL || getRequestURL(event).origin).replace(/\/+$/, '')
  return `${base}/f/${token}`
}

export type FormRequestStatus = 'sent' | 'opened' | 'submitted' | 'revoked' | 'expired'

/** Stored status, with sent/opened links past their expiry reported as expired. */
export function effectiveStatus(r: { status: string, expires_at: Date }, now = new Date()): FormRequestStatus {
  if ((r.status === 'sent' || r.status === 'opened') && r.expires_at <= now) return 'expired'
  return r.status as FormRequestStatus
}

export const formRequestInclude = {
  form: { select: { name: true } },
  form_version: { select: { version: true } },
  business: { select: { name: true } },
  creator: { select: { username: true } },
  submission: { select: { id: true } },
} as const

type RequestWithRelations = {
  token_hash: string
  status: string
  expires_at: Date
  form: { name: string }
  form_version: { version: number }
  business: { name: string } | null
  creator: { username: string } | null
  submission?: { id: number } | null
  [key: string]: unknown
}

/** API shape: relations flattened, token hash never included. */
export function formRequestRow<T extends RequestWithRelations>(r: T) {
  const { token_hash: _hash, form, form_version, business, creator, submission, ...rest } = r
  return {
    ...rest,
    status: effectiveStatus(r),
    form_name: form.name,
    version: form_version.version,
    business_name: business?.name ?? null,
    created_by_username: creator?.username ?? null,
    submission_id: submission?.id ?? null,
  }
}
