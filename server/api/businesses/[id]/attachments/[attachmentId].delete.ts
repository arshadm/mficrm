import { idParam, prisma } from '../../../../db/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'attachmentId')
  const attachment = await prisma.attachment.findUnique({ where: { id }, select: { filename: true } })
  if (!attachment) throw createError({ statusCode: 404, message: 'Attachment not found' })

  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  try {
    await unlink(join(uploadDir, attachment.filename))
  } catch {}

  await prisma.attachment.deleteMany({ where: { id } })
  return { success: true }
})
