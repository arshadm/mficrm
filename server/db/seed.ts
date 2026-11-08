import { prisma, toDate } from './prisma'
import { hashUserPassword as hashPassword } from '../utils/auth'

export async function seedDatabase() {
  // Seed admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme'

  let admin = await prisma.user.findUnique({ where: { username: adminUsername }, select: { id: true } })
  if (!admin) {
    admin = await prisma.user.create({
      data: { username: adminUsername, password_hash: await hashPassword(adminPassword), email: 'admin@acquiredesk.com', role: 'admin' },
      select: { id: true },
    })
  }

  // Sample data only into an empty database
  if (await prisma.business.count()) return

  const followUp = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  await prisma.business.create({
    data: {
      name: 'ContentFlow Pro',
      category: 'saas',
      stage: 'qualified',
      description: 'A SaaS content scheduling and analytics platform with 450 paying customers and strong MRR growth.',
      listing_url: 'https://empireflippers.com/listing/sample1',
      asking_price: 380000,
      trailing_12m_revenue: 95000,
      trailing_12m_profit: 58000,
      platform: 'Empire Flippers',
      date_listed: toDate('2026-02-15'),
      assigned_to: admin.id,
      follow_up_date: toDate(followUp),
      follow_up_note: 'Schedule intro call with seller',
      interactions: {
        create: { user_id: admin.id, type: 'note', title: 'Initial Review', body: '<p>Strong metrics. Revenue growth of 40% YoY. Team of 2. Worth pursuing.</p>' },
      },
    },
  })

  await prisma.business.create({
    data: {
      name: 'NicheBlog Network',
      category: 'content',
      stage: 'seller_engaged',
      description: 'A portfolio of 8 niche content sites monetised via display ads and affiliate. DA 35-50 across sites.',
      listing_url: 'https://flippa.com/listing/sample2',
      asking_price: 220000,
      trailing_12m_revenue: 72000,
      trailing_12m_profit: 41000,
      platform: 'Flippa',
      date_listed: toDate('2026-01-28'),
      assigned_to: admin.id,
      interactions: {
        create: { user_id: admin.id, type: 'call', title: 'Intro Call with Seller', body: '<p>Good call. Seller motivated to exit within 60 days. Willing to do 3-month transition.</p>' },
      },
    },
  })

  await prisma.business.create({
    data: {
      name: 'FBA Kitchenware Store',
      category: 'fba',
      stage: 'initial_interest',
      description: 'Amazon FBA brand selling premium kitchenware. 4.6 star average rating, 1200+ reviews.',
      asking_price: 145000,
      trailing_12m_revenue: 210000,
      trailing_12m_profit: 38000,
      platform: 'MicroAcquire',
      assigned_to: admin.id,
      interactions: {
        create: { user_id: admin.id, type: 'note', title: 'Added to Pipeline', body: '<p>Discovered via MicroAcquire digest. FBA margins look thin but brand has potential.</p>' },
      },
    },
  })
}
