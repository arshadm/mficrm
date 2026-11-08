import { idParam, orNotFound, prisma, toDate } from '../../../db/prisma'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1),
  notes: z.string().optional().nullable(),
  due_date: z.string().min(1, 'Due date is required'),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })

  // Enforce: only one pending primary step per business
  const existing = await prisma.nextStep.findFirst({
    where: { business_id, is_primary: true, status: 'pending' },
    select: { id: true },
  })
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'This business already has an active primary next step. Complete or skip it before adding a new one.',
    })
  }

  const d = parsed.data
  return orNotFound(prisma.nextStep.create({
    data: {
      business_id,
      title: d.title,
      notes: d.notes ?? null,
      due_date: toDate(d.due_date)!,
      is_primary: true,
      status: 'pending',
      created_by: session.user.id,
    },
  }), 'Business not found')
})
