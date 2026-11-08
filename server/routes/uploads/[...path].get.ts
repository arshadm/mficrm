import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { getDb } from '../../db/database'

// Serves attachments from UPLOAD_DIR at request time (it's a volume in production, so files can't be baked into
// the build as public assets). Still public, as before (server/middleware/auth.ts); see mficrm-xln.3.
export default defineEventHandler(async (event) => {
  const filename = basename(getRouterParam(event, 'path') || '')
  if (!filename || filename.startsWith('.')) throw createError({ statusCode: 404 })

  const filePath = join(resolve(process.env.UPLOAD_DIR || './uploads'), filename)
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile()) throw createError({ statusCode: 404 })

  const row = getDb()
    .prepare('SELECT original_name, mime_type FROM attachments WHERE filename = ?')
    .get(filename) as { original_name: string, mime_type: string | null } | undefined

  setResponseHeaders(event, {
    'Content-Type': row?.mime_type || 'application/octet-stream',
    'Content-Length': String(info.size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row?.original_name || filename)}`,
    'X-Content-Type-Options': 'nosniff',
  })
  return sendStream(event, createReadStream(filePath))
})
