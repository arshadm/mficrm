import { getDb } from '../db/database'

// Kamal health check (config/deploy.yml). Public: exempted in server/middleware/auth.ts.
export default defineEventHandler(() => {
  getDb().prepare('SELECT 1').get()
  return { status: 'ok', time: new Date().toISOString() }
})
