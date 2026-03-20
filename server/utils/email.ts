import nodemailer from 'nodemailer'
import { getDb } from '../db/database'

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

interface FollowUp {
  id: number
  name: string
  stage: string
  follow_up_note: string | null
  user_email: string | null
  username: string | null
}

interface NextStepDue {
  business_id: number
  business_name: string
  step_title: string
  step_notes: string | null
  user_email: string | null
}

export async function sendFollowUpReminders() {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  // Query follow-ups
  const followUps = db.prepare(`
    SELECT b.id, b.name, b.stage, b.follow_up_note, u.email as user_email, u.username
    FROM businesses b
    LEFT JOIN users u ON b.assigned_to = u.id
    WHERE b.follow_up_date <= ? AND b.is_archived = 0
  `).all(today) as FollowUp[]

  // Query next steps due today
  const nextStepsDue = db.prepare(`
    SELECT b.id as business_id, b.name as business_name,
           ns.title as step_title, ns.notes as step_notes,
           u.email as user_email
    FROM next_steps ns
    JOIN businesses b ON ns.business_id = b.id
    LEFT JOIN users u ON b.assigned_to = u.id
    WHERE ns.is_primary = 1 AND ns.status = 'pending'
      AND ns.due_date = ? AND b.is_archived = 0
  `).all(today) as NextStepDue[]

  if (!followUps.length && !nextStepsDue.length) return

  // Group by email
  const byEmail = new Map<string, { followUps: FollowUp[], nextSteps: NextStepDue[] }>()

  for (const f of followUps) {
    if (!f.user_email) continue
    if (!byEmail.has(f.user_email)) byEmail.set(f.user_email, { followUps: [], nextSteps: [] })
    byEmail.get(f.user_email)!.followUps.push(f)
  }

  for (const n of nextStepsDue) {
    if (!n.user_email) continue
    if (!byEmail.has(n.user_email)) byEmail.set(n.user_email, { followUps: [], nextSteps: [] })
    byEmail.get(n.user_email)!.nextSteps.push(n)
  }

  if (!byEmail.size) return

  const transporter = getTransporter()
  const from = process.env.SMTP_FROM || 'crm@acquiredesk.com'

  for (const [email, data] of byEmail) {
    const sections: string[] = []

    if (data.followUps.length) {
      sections.push(`
        <h2 style="color:#1e40af">📋 Follow-up Reminders</h2>
        ${data.followUps.map(b => `
          <div style="margin-bottom:12px;padding:12px;border:1px solid #e5e7eb;border-radius:8px">
            <strong><a href="${appUrl}/businesses/${b.id}">${b.name}</a></strong><br/>
            Stage: ${b.stage.replace(/_/g, ' ')}
            ${b.follow_up_note ? `<br/>Note: ${b.follow_up_note}` : ''}
          </div>
        `).join('')}
      `)
    }

    if (data.nextSteps.length) {
      sections.push(`
        <h2 style="color:#065f46">✅ Next Steps Due Today</h2>
        ${data.nextSteps.map(n => `
          <div style="margin-bottom:12px;padding:12px;border:1px solid #d1fae5;border-radius:8px">
            <strong><a href="${appUrl}/businesses/${n.business_id}?tab=next-steps">${n.business_name}</a></strong><br/>
            Next step: <strong>${n.step_title}</strong>
            ${n.step_notes ? `<br/>Notes: ${n.step_notes}` : ''}
          </div>
        `).join('')}
      `)
    }

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject: `[AcquireDesk] Daily digest — ${today}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h1 style="color:#1f2937">AcquireDesk Daily Digest</h1>
            <p style="color:#6b7280">${today}</p>
            ${sections.join('<hr style="margin:24px 0"/>')}
            <p style="color:#9ca3af;font-size:12px;margin-top:32px">
              Sent by AcquireDesk · <a href="${appUrl}">Open app</a>
            </p>
          </div>
        `,
      })
    } catch (err) {
      console.error(`[Email] Failed to send digest to ${email}:`, err)
    }
  }
}
