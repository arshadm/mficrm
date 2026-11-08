import { idParam, orNotFound, prisma } from '../../../db/prisma'
import { hashUserPassword as hashPassword } from '../../../utils/auth'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if ((session.user as { role: string }).role !== 'admin') throw createError({ statusCode: 403, message: 'Forbidden' })

  const id = idParam(event, 'userId')
  const body = await readBody(event)

  const Schema = z.object({
    email: z.string().email().optional().nullable(),
    role: z.enum(['admin', 'user']).optional(),
    password: z.string().min(8).optional(),
  })

  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  return orNotFound(prisma.user.update({
    where: { id },
    data: {
      email: d.email,
      role: d.role,
      password_hash: d.password ? await hashPassword(d.password) : undefined,
    },
    select: { id: true, username: true, email: true, role: true, created_at: true },
  }), 'User not found')
})
