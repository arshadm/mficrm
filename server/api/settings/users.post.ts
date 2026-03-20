import { getDb } from '../../db/database'
import { CreateUserSchema } from '~/shared/schemas'
import { hashUserPassword as hashPassword } from "../../utils/auth"

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })

  const db = getDb()
  const hash = await hashPassword(parsed.data.password)

  try {
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)'
    ).run(parsed.data.username, hash, parsed.data.email ?? null, parsed.data.role)

    return db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid)
  } catch {
    throw createError({ statusCode: 409, message: 'Username already exists' })
  }
})
