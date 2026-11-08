import { idParam, orNotFound, prisma, toDate } from '../../../../db/prisma'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  due_date: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'stepId')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  return orNotFound(prisma.nextStep.update({
    where: { id },
    data: {
      title: d.title,
      notes: d.notes === undefined ? undefined : d.notes ?? null,
      due_date: d.due_date ? toDate(d.due_date)! : undefined,
      updated_at: new Date(),
    },
  }), 'Step not found')
})
