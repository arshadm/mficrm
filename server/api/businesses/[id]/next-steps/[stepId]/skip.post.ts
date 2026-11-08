import { idParam, prisma } from '../../../../../db/prisma'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const business_id = idParam(event, 'id')
  const id = idParam(event, 'stepId')
  const body = await readBody(event)
  const { completion_note } = z.object({ completion_note: z.string().optional() }).parse(body)

  const step = await prisma.nextStep.findUnique({ where: { id }, select: { title: true } })
  if (!step) throw createError({ statusCode: 404, message: 'Step not found' })

  const now = new Date()
  const [updated] = await prisma.$transaction([
    prisma.nextStep.update({
      where: { id },
      data: { status: 'skipped', completed_at: now, completed_by: session.user.id, completion_note: completion_note ?? null, updated_at: now },
    }),
    // Log interaction
    prisma.interaction.create({
      data: {
        business_id,
        user_id: session.user.id,
        type: 'note',
        title: `Next step skipped: ${step.title}`,
        body: completion_note ? `<p>${completion_note}</p>` : '<p>Next step was skipped.</p>',
        occurred_at: now,
        created_at: now,
      },
    }),
    prisma.business.update({ where: { id: business_id }, data: { last_updated: now }, select: { id: true } }),
  ])
  return updated
})
