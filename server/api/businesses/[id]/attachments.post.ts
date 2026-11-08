import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { removeUpload, storeUpload } from '../../../utils/files'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'No files provided' })

  const interactionField = formData.find(f => f.name === 'interaction_id')?.data.toString()
  const interaction_id = interactionField ? Number(interactionField) : null
  const saved: unknown[] = []

  for (const file of formData) {
    if (!file.filename) continue
    const stored = await storeUpload(file)
    try {
      saved.push(await orNotFound(
        prisma.attachment.create({ data: { interaction_id, business_id, ...stored } }),
        'Business or interaction not found',
      ))
    } catch (err) {
      await removeUpload(stored.filename) // don't leave an orphaned file behind
      throw err
    }
  }

  return saved
})
