import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { basename, join } from 'path'
import { prisma } from '../../db/prisma'
import { fileResponseHeaders, uploadDir } from '../../utils/files'

// Serves stored files from UPLOAD_DIR to logged-in users only. (Files are on a volume in production, so they can't
// be baked into the build as public assets.)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const filename = basename(getRouterParam(event, 'path') || '')
  if (!filename || filename.startsWith('.')) throw createError({ statusCode: 404 })

  // Only files the app recorded; anything else in the directory is never served
  const row = await prisma.attachment.findUnique({ where: { filename }, select: { original_name: true, mime_type: true } })
  if (!row) throw createError({ statusCode: 404 })

  const filePath = join(uploadDir(), filename)
  const info = await stat(filePath).catch(() => null)
  if (!info?.isFile()) throw createError({ statusCode: 404 })

  setResponseHeaders(event, fileResponseHeaders(row, info.size, filename))
  return sendStream(event, createReadStream(filePath))
})
