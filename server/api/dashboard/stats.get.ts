import { prisma, today } from '../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const active = { is_archived: false }

  const [total, byStageRows, byCategoryRows, asking, mid, followUps, recent] = await Promise.all([
    prisma.business.count({ where: active }),
    prisma.business.groupBy({ by: ['stage'], where: active, _count: { _all: true } }),
    prisma.business.groupBy({ by: ['category'], where: active, _count: { _all: true } }),
    prisma.business.aggregate({ where: active, _sum: { asking_price: true } }),
    prisma.valuation.aggregate({ where: { business: active }, _sum: { estimated_value_mid: true } }),
    prisma.business.findMany({
      where: { ...active, follow_up_date: { lte: today() } },
      select: { id: true, name: true, stage: true, follow_up_date: true, follow_up_note: true },
      orderBy: [{ follow_up_date: 'asc' }, { id: 'asc' }],
    }),
    prisma.interaction.findMany({
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: 5,
      include: { business: { select: { name: true } }, user: { select: { username: true } } },
    }),
  ])

  return {
    total,
    byStage: byStageRows.map(r => ({ stage: r.stage, count: r._count._all })),
    byCategory: byCategoryRows.map(r => ({ category: r.category, count: r._count._all })),
    totalAskingPrice: asking._sum.asking_price ?? 0,
    totalMidValue: mid._sum.estimated_value_mid ?? 0,
    followUps,
    recentInteractions: recent.map(({ business, user, ...i }) => ({ ...i, business_name: business.name, username: user?.username ?? null })),
  }
})
