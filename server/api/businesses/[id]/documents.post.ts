import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { DOCUMENT_EXTENSIONS, removeUpload, storeUpload } from '../../../utils/files'

// Adds documents to a company: PDF (e.g. the Flippa listing export) and CSV/Excel (P&L accounts)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const parts = ((await readMultipartFormData(event)) ?? []).filter(p => p.filename)
  if (!parts.length) throw createError({ statusCode: 400, message: 'No files provided' })

  // All or nothing: if any file is rejected, the ones already stored are removed
  const stored = []
  try {
    for (const part of parts) stored.push(await storeUpload(part, { allowedExtensions: DOCUMENT_EXTENSIONS }))
    await orNotFound(prisma.attachment.createMany({ data: stored.map(f => ({ ...f, business_id })) }), 'Business not found')
  } catch (err) {
    await Promise.all(stored.map(f => removeUpload(f.filename)))
    throw err
  }
  return prisma.attachment.findMany({
    where: { filename: { in: stored.map(f => f.filename) } },
    select: { id: true, filename: true, original_name: true, mime_type: true, file_size: true, uploaded_at: true },
  })
})
