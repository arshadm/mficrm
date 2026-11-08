import { randomBytes } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join, resolve } from 'path'

// All uploaded files (CRM attachments now, public form uploads later) are stored in UPLOAD_DIR under random names
// and are only served to logged-in users (server/routes/uploads/[...path].get.ts).

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/** Types a browser may display inline. Everything else is served as a download. */
const INLINE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain',
])

/** Types that are never accepted, because a browser would run them as active content. */
const BLOCKED_EXTENSIONS = new Set(['.html', '.htm', '.xhtml', '.svg', '.svgz', '.xml', '.js', '.mjs', '.php', '.exe', '.bat', '.cmd', '.sh'])

/** Company documents (mficrm-b6g.2): listing exports and P&L accounts */
export const DOCUMENT_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.xls']

export function uploadDir(): string {
  return resolve(process.env.UPLOAD_DIR || './uploads')
}

export interface StoredFile {
  filename: string
  original_name: string
  mime_type: string | null
  file_size: number
}

/**
 * Validates and writes one uploaded file under a random name. Throws 400 for an empty, oversized or blocked file.
 * `allowedExtensions` narrows the accepted types further (e.g. for public forms).
 */
export async function storeUpload(
  file: { filename?: string, type?: string, data: Buffer },
  options: { maxBytes?: number, allowedExtensions?: string[] } = {},
): Promise<StoredFile> {
  const original = (file.filename || 'file').slice(0, 255)
  const ext = extname(original).toLowerCase()
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES

  if (!file.data?.length) throw createError({ statusCode: 400, message: `${original} is empty` })
  if (file.data.length > maxBytes) {
    throw createError({ statusCode: 400, message: `${original} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit` })
  }
  if (BLOCKED_EXTENSIONS.has(ext) || (options.allowedExtensions && !options.allowedExtensions.includes(ext))) {
    throw createError({ statusCode: 400, message: `${original}: this file type is not allowed` })
  }

  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  const filename = `${randomBytes(16).toString('hex')}${ext}`
  await writeFile(join(dir, filename), file.data)
  return { filename, original_name: original, mime_type: file.type || null, file_size: file.data.length }
}

export async function removeUpload(filename: string): Promise<void> {
  await unlink(join(uploadDir(), filename)).catch(() => {})
}

/** Response headers for serving a stored file safely. */
export function fileResponseHeaders(meta: { original_name?: string | null, mime_type?: string | null }, size: number, filename: string) {
  const type = meta.mime_type && INLINE_TYPES.has(meta.mime_type) ? meta.mime_type : null
  const name = encodeURIComponent(meta.original_name || filename)
  return {
    'Content-Type': type || 'application/octet-stream',
    'Content-Length': String(size),
    'Content-Disposition': `${type ? 'inline' : 'attachment'}; filename*=UTF-8''${name}`,
    'X-Content-Type-Options': 'nosniff',
    // Even if something slips through, the file can't run scripts or reach the CRM's origin
    'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    'Cache-Control': 'private, no-store',
  }
}
