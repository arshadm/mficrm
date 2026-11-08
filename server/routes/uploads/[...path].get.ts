import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { basename, join, resolve } from 'path'
import { prisma } from '../../db/prisma'

// Serves attachments from UPLOAD_DIR at request time (it's a volume in production, so files can't be baked into
// the build as public assets). Still public, as before (server/middleware/auth.ts); see mficrm-xln.3.
export default defineEventHandler(async (event) => {
  const filename = basename(getRouterParam(event, 'path') || '')
  if (!filename || filename.startsWith('.')) throw createError({ statusCode: 404 })

  const filePath = join(resolve(process.env.UPLOAD_DIR || './uploads'), filename)
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile()) throw createError({ statusCode: 404 })

  const row = await prisma.attachment.findUnique({ where: { filename }, select: { original_name: true, mime_type: true } })

  setResponseHeaders(event, {
    'Content-Type': row?.mime_type || 'application/octet-stream',
    'Content-Length': String(info.size),
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row?.original_name || filename)}`,
    'X-Content-Type-Options': 'nosniff',
  })
  return sendStream(event, createReadStream(filePath))
})
