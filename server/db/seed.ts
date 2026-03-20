import { getDb } from './database'
import { hashUserPassword as hashPassword } from '../utils/auth'

export async function seedDatabase() {
  const db = getDb()

  // Seed admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme'

  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)

  if (!existingAdmin) {
    const hash = await hashPassword(adminPassword)
    db.prepare(
      'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)'
    ).run(adminUsername, hash, 'admin@acquiredesk.com', 'admin')
  }

  // Check if sample data exists
  const count = (db.prepare('SELECT COUNT(*) as c FROM businesses').get() as { c: number }).c
  if (count > 0) return

  // Get admin user id
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername) as { id: number }

  // Seed sample businesses
  const now = new Date().toISOString()

  const b1 = db.prepare(`
    INSERT INTO businesses (name, category, stage, description, listing_url, asking_price,
    trailing_12m_revenue, trailing_12m_profit, platform, date_listed, assigned_to, follow_up_date,
    follow_up_note, date_added, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'ContentFlow Pro',
    'saas',
    'qualified',
    'A SaaS content scheduling and analytics platform with 450 paying customers and strong MRR growth.',
    'https://empireflippers.com/listing/sample1',
    380000,
    95000,
    58000,
    'Empire Flippers',
    '2026-02-15',
    admin.id,
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    'Schedule intro call with seller',
    now,
    now
  )

  const b2 = db.prepare(`
    INSERT INTO businesses (name, category, stage, description, listing_url, asking_price,
    trailing_12m_revenue, trailing_12m_profit, platform, date_listed, assigned_to, date_added, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'NicheBlog Network',
    'content',
    'seller_engaged',
    'A portfolio of 8 niche content sites monetised via display ads and affiliate. DA 35-50 across sites.',
    'https://flippa.com/listing/sample2',
    220000,
    72000,
    41000,
    'Flippa',
    '2026-01-28',
    admin.id,
    now,
    now
  )

  const b3 = db.prepare(`
    INSERT INTO businesses (name, category, stage, description, asking_price,
    trailing_12m_revenue, trailing_12m_profit, platform, assigned_to, date_added, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'FBA Kitchenware Store',
    'fba',
    'initial_interest',
    'Amazon FBA brand selling premium kitchenware. 4.6 star average rating, 1200+ reviews.',
    145000,
    210000,
    38000,
    'MicroAcquire',
    admin.id,
    now,
    now
  )

  // Seed interactions
  db.prepare(`
    INSERT INTO interactions (business_id, user_id, type, title, body, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(b1.lastInsertRowid, admin.id, 'note', 'Initial Review', '<p>Strong metrics. Revenue growth of 40% YoY. Team of 2. Worth pursuing.</p>', now, now)

  db.prepare(`
    INSERT INTO interactions (business_id, user_id, type, title, body, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(b2.lastInsertRowid, admin.id, 'call', 'Intro Call with Seller', '<p>Good call. Seller motivated to exit within 60 days. Willing to do 3-month transition.</p>', now, now)

  db.prepare(`
    INSERT INTO interactions (business_id, user_id, type, title, body, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(b3.lastInsertRowid, admin.id, 'note', 'Added to Pipeline', '<p>Discovered via MicroAcquire digest. FBA margins look thin but brand has potential.</p>', now, now)
}
