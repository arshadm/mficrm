import { runMigrations } from '../db/migrate'
import { seedDatabase } from '../db/seed'
import { startCronJobs } from '../utils/cron'

export default defineNitroPlugin(async () => {
  console.log('[Init] Running database migrations...')
  runMigrations()
  console.log('[Init] Seeding database...')
  await seedDatabase()
  console.log('[Init] Starting cron jobs...')
  startCronJobs()
  console.log('[Init] Server initialization complete.')
})
