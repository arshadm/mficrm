import { LoginSchema } from '~/shared/schemas'
import { getDb } from '../../db/database'
import { verifyUserPassword as verifyPassword } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = LoginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.errors })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(parsed.data.username) as {
    id: number, username: string, password_hash: string, email: string, role: string
  } | undefined

  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const valid = await verifyPassword(parsed.data.password, user.password_hash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await setUserSession(event, {
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  })

  return { id: user.id, username: user.username, email: user.email, role: user.role }
})
