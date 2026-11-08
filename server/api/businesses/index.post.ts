import { prisma, toDate } from '../../db/prisma'
import { CreateBusinessSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const body = await readBody(event)
  const parsed = CreateBusinessSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Validation error', data: parsed.error.errors })
  }

  const d = parsed.data
  return prisma.business.create({
    data: {
      name: d.name,
      category: d.category,
      stage: d.stage,
      description: d.description ?? null,
      listing_url: d.listing_url || null,
      asking_price: d.asking_price ?? null,
      trailing_12m_revenue: d.trailing_12m_revenue ?? null,
      trailing_12m_profit: d.trailing_12m_profit ?? null,
      platform: d.platform ?? null,
      date_listed: toDate(d.date_listed),
      assigned_to: d.assigned_to ?? null,
      follow_up_date: toDate(d.follow_up_date),
      follow_up_note: d.follow_up_note ?? null,
    },
  })
})
