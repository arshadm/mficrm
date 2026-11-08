import { prisma } from '../../db/prisma'
import { CreateUserSchema } from '~/shared/schemas'
import { hashUserPassword as hashPassword } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  const body = await readBody(event)
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })

  const hash = await hashPassword(parsed.data.password)
  try {
    return await prisma.user.create({
      data: { username: parsed.data.username, password_hash: hash, email: parsed.data.email ?? null, role: parsed.data.role },
      select: { id: true, username: true, email: true, role: true, created_at: true },
    })
  } catch (err) {
    // P2002: unique constraint (username)
    if ((err as { code?: string })?.code === 'P2002') throw createError({ statusCode: 409, message: 'Username already exists' })
    throw err
  }
})
