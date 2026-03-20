import { getDb } from '../../../../db/database'
import { unlink } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const attachmentId = getRouterParam(event, 'attachmentId')
  const db = getDb()

  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId) as { filename: string } | undefined
  if (!attachment) throw createError({ statusCode: 404, message: 'Attachment not found' })

  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  try {
    await unlink(join(uploadDir, attachment.filename))
  } catch {}

  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId)
  return { success: true }
})
