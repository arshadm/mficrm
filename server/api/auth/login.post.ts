import { LoginSchema } from '~/shared/schemas'
import { getDb } from '../../db/database'
import { burnPasswordCheck, hashUserPassword, needsRehash, verifyUserPassword } from '../../utils/auth'
import { assertLoginAllowed, recordLoginFailure, recordLoginSuccess } from '../../utils/loginRateLimit'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = LoginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid input', data: parsed.error.errors })
  }

  const { username, password } = parsed.data
  assertLoginAllowed(event, username)

  const db = getDb()
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as {
    id: number, username: string, password_hash: string, email: string, role: string
  } | undefined

  // Same work and the same answer whether or not the username exists
  const valid = user ? await verifyUserPassword(password, user.password_hash) : (await burnPasswordCheck(password), false)
  if (!user || !valid) {
    recordLoginFailure(event, username)
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  recordLoginSuccess(event, username)

  // Upgrade legacy SHA-256 (or outdated scrypt) hashes now that we have the plain password
  if (needsRehash(user.password_hash)) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashUserPassword(password), user.id)
  }

  await setUserSession(event, {
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
  })

  return { id: user.id, username: user.username, email: user.email, role: user.role }
})
