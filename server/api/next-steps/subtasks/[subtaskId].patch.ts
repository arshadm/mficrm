import { idParam, orNotFound, prisma, toDate } from '../../../db/prisma'
import { z } from 'zod'

const Schema = z.object({
  title: z.string().min(1).optional(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['pending', 'done', 'skipped']).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'subtaskId')
  const body = await readBody(event)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const d = parsed.data
  const now = new Date()
  // due_date is required on next_steps: a null leaves it unchanged (SQLite rejected the write instead)
  return orNotFound(prisma.nextStep.update({
    where: { id },
    data: {
      title: d.title,
      due_date: d.due_date ? toDate(d.due_date)! : undefined,
      status: d.status,
      completed_at: d.status === 'done' ? now : undefined,
      updated_at: now,
    },
  }), 'Subtask not found')
})
