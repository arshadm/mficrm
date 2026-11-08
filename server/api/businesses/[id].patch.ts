import { idParam, prisma, toDate } from '../../db/prisma'
import { UpdateBusinessSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'id')
  const body = await readBody(event)
  const parsed = UpdateBusinessSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })
  }

  const existing = await prisma.business.findUnique({ where: { id }, select: { stage: true } })
  if (!existing) throw createError({ statusCode: 404, message: 'Business not found' })

  const d = parsed.data
  const now = new Date()

  // Log stage change if stage changed
  if (d.stage && d.stage !== existing.stage) {
    await prisma.interaction.create({
      data: {
        business_id: id,
        user_id: session.user.id,
        type: 'stage_change',
        title: 'Stage Changed',
        body: `<p>Stage changed from <strong>${existing.stage.replace(/_/g, ' ')}</strong> to <strong>${d.stage.replace(/_/g, ' ')}</strong>.</p>`,
        occurred_at: now,
        created_at: now,
      },
    })
  }

  // Only fields present in the request are changed (undefined leaves a column alone)
  return prisma.business.update({
    where: { id },
    data: {
      name: d.name,
      category: d.category,
      stage: d.stage,
      description: d.description,
      // '' clears the URL; absent leaves it alone
      listing_url: d.listing_url === undefined ? undefined : d.listing_url || null,
      asking_price: d.asking_price,
      trailing_12m_revenue: d.trailing_12m_revenue,
      trailing_12m_profit: d.trailing_12m_profit,
      platform: d.platform,
      date_listed: d.date_listed === undefined ? undefined : toDate(d.date_listed),
      assigned_to: d.assigned_to,
      follow_up_date: d.follow_up_date === undefined ? undefined : toDate(d.follow_up_date),
      follow_up_note: d.follow_up_note,
      last_updated: now,
    },
  })
})
