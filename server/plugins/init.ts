import { seedDatabase } from '../db/seed'
import { startCronJobs } from '../utils/cron'

// Migrations are not run here: `npm run db:migrate` in development, and `prisma migrate deploy` in the container
// entrypoint in production (bin/docker-entrypoint).
export default defineNitroPlugin(async () => {
  console.log('[Init] Seeding database...')
  try {
    await seedDatabase()
  } catch (err) {
    console.error('[Init] Seeding failed (has `npm run db:migrate` been run?):', err)
  }
  console.log('[Init] Starting cron jobs...')
  startCronJobs()
  console.log('[Init] Server initialization complete.')
})
