import { idParam, orNotFound, prisma } from '../../../../db/prisma'
import { removeUpload, storeUpload } from '../../../../utils/files'

// Stores an image pasted or dropped into the company's notes. Recorded as an attachment of the business (so
// /uploads serves it to logged-in users), but not listed among its documents.
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const business_id = idParam(event, 'id')
  const part = ((await readMultipartFormData(event)) ?? []).find(p => p.filename)
  if (!part) throw createError({ statusCode: 400, message: 'No image provided' })
  const stored = await storeUpload(part, { allowedExtensions: IMAGE_EXTENSIONS })
  try {
    await orNotFound(prisma.attachment.create({ data: { ...stored, business_id } }), 'Business not found')
  } catch (err) {
    await removeUpload(stored.filename)
    throw err
  }
  return { url: `/uploads/${stored.filename}`, name: stored.original_name }
})
