import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'No files provided' })

  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const interactionField = formData.find(f => f.name === 'interaction_id')?.data.toString()
  const interaction_id = interactionField ? Number(interactionField) : null
  const saved: unknown[] = []

  for (const file of formData) {
    if (!file.filename || !file.data) continue
    if (file.data.length > 20 * 1024 * 1024) {
      throw createError({ statusCode: 400, message: `File ${file.filename} exceeds 20MB limit` })
    }

    const filename = `${randomBytes(16).toString('hex')}${extname(file.filename)}`
    const filePath = join(uploadDir, filename)
    await writeFile(filePath, file.data)

    try {
      saved.push(await orNotFound(prisma.attachment.create({
        data: {
          interaction_id,
          business_id,
          filename,
          original_name: file.filename,
          mime_type: file.type || null,
          file_size: file.data.length,
        },
      }), 'Business or interaction not found'))
    } catch (err) {
      await unlink(filePath).catch(() => {}) // don't leave an orphaned file behind
      throw err
    }
  }

  return saved
})
