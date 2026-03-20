import { getDb } from '../../../db/database'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const formData = await readMultipartFormData(event)
  if (!formData) throw createError({ statusCode: 400, message: 'No files provided' })

  const uploadDir = process.env.UPLOAD_DIR || './uploads'
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const db = getDb()
  const now = new Date().toISOString()
  const saved: unknown[] = []

  const interactionId = formData.find(f => f.name === 'interaction_id')?.data.toString()

  for (const file of formData) {
    if (!file.filename || !file.data) continue
    if (file.data.length > 20 * 1024 * 1024) {
      throw createError({ statusCode: 400, message: `File ${file.filename} exceeds 20MB limit` })
    }

    const ext = extname(file.filename)
    const filename = `${randomBytes(16).toString('hex')}${ext}`
    const filePath = join(uploadDir, filename)
    await writeFile(filePath, file.data)

    const result = db.prepare(`
      INSERT INTO attachments (interaction_id, business_id, filename, original_name, mime_type, file_size, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      interactionId ? Number(interactionId) : null,
      id, filename, file.filename, file.type || null, file.data.length, now
    )

    saved.push(db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid))
  }

  return saved
})
