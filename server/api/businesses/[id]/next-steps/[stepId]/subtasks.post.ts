import { idParam, orNotFound, prisma, toDate, today } from '../../../../../db/prisma'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1),
  due_date: z.string().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const parent_id = idParam(event, 'stepId')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  return orNotFound(prisma.nextStep.create({
    data: {
      business_id,
      parent_id,
      title: d.title,
      due_date: toDate(d.due_date) ?? today(),
      is_primary: false,
      status: 'pending',
      created_by: session.user.id,
    },
  }), 'Business or step not found')
})
