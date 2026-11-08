import { prisma } from '../db/prisma'

// Kamal health check (config/deploy.yml). Public: exempted in server/middleware/auth.ts.
export default defineEventHandler(async () => {
  await prisma.$queryRaw`SELECT 1`
  return { status: 'ok', time: new Date().toISOString() }
})
