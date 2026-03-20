import { getDb } from '../../../db/database'
import { hashUserPassword as hashPassword } from '../../../utils/auth'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  const userId = getRouterParam(event, 'userId')
  const body = await readBody(event)

  const Schema = z.object({
    email: z.string().email().optional().nullable(),
    role: z.enum(['admin', 'user']).optional(),
    password: z.string().min(8).optional(),
  })

  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const d = parsed.data
  const fields: string[] = []
  const values: (string | null)[] = []

  if (d.email !== undefined) { fields.push('email = ?'); values.push(d.email) }
  if (d.role !== undefined) { fields.push('role = ?'); values.push(d.role) }
  if (d.password) {
    const hash = await hashPassword(d.password)
    fields.push('password_hash = ?')
    values.push(hash)
  }

  if (!fields.length) return db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(userId)

  values.push(userId as string)
  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(userId)
})
