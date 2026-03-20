import cron from 'node-cron'
import { getDb } from '../db/database'
import { sendFollowUpReminders } from './email'

export function startCronJobs() {
  // Run daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('[Cron] Running follow-up reminder job...')
    try {
      await sendFollowUpReminders()
    } catch (err) {
      console.error('[Cron] Follow-up reminder error:', err)
    }
  })
}
