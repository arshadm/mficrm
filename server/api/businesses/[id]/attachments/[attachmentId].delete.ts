import { idParam, prisma } from '../../../../db/prisma'
import { removeUpload } from '../../../../utils/files'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const id = idParam(event, 'attachmentId')
  // Only an attachment of this business
  const attachment = await prisma.attachment.findFirst({ where: { id, business_id }, select: { filename: true } })
  if (!attachment) throw createError({ statusCode: 404, message: 'Attachment not found' })

  await removeUpload(attachment.filename)
  await prisma.attachment.deleteMany({ where: { id } })
  return { success: true }
})
