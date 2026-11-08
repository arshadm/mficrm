import nodemailer from 'nodemailer'
import { prisma } from '../db/prisma'
import { escapeHtml } from './html'

// Production sends through Google (smtp.gmail.com:587 with a Workspace App Password; see docs/deploy.md).
// Port 465 uses implicit TLS; any other port must upgrade with STARTTLS, so credentials never go out in clear.
function getTransporter() {
  const port = parseInt(process.env.SMTP_PORT || '587')
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/** Email is optional: without SMTP_HOST, reminders are skipped (e.g. in development). */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST)
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
  if (!emailConfigured()) {
    console.log('[email] SMTP_HOST not set, skipping follow-up reminders')
    return
  }
  const today = new Date().toISOString().split('T')[0]
  const todayDate = new Date(`${today}T00:00:00Z`)
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  // Businesses whose follow-up date has arrived
  const followUps: FollowUp[] = (await prisma.business.findMany({
    where: { follow_up_date: { lte: todayDate }, is_archived: false },
    select: { id: true, name: true, stage: true, follow_up_note: true, assignee: { select: { email: true, username: true } } },
  })).map(({ assignee, ...b }) => ({ ...b, user_email: assignee?.email ?? null, username: assignee?.username ?? null }))

  // Primary next steps due today
  const nextStepsDue: NextStepDue[] = (await prisma.nextStep.findMany({
    where: { is_primary: true, status: 'pending', due_date: todayDate, business: { is_archived: false } },
    select: { title: true, notes: true, business: { select: { id: true, name: true, assignee: { select: { email: true } } } } },
  })).map(s => ({
    business_id: s.business.id,
    business_name: s.business.name,
    step_title: s.title,
    step_notes: s.notes,
    user_email: s.business.assignee?.email ?? null,
  }))

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

/** Emails a form link (mficrm-xln.4). Throws if sending fails, so the caller can report it. */
export async function sendFormLinkEmail(opts: {
  to: string
  recipientName?: string | null
  formName: string
  description?: string | null
  message?: string | null
  url: string
  expiresAt: Date
  senderName: string
}) {
  if (!emailConfigured()) throw createError({ statusCode: 400, message: 'Email is not configured (SMTP_HOST)' })
  const from = process.env.SMTP_FROM || 'crm@acquiredesk.com'
  const expires = opts.expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const greeting = opts.recipientName ? `Hello ${opts.recipientName},` : 'Hello,'
  const paragraphs = (text: string) => text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')

  await getTransporter().sendMail({
    from,
    to: opts.to,
    subject: opts.formName,
    text: [
      greeting, '',
      opts.message || `${opts.senderName} has asked you to fill in "${opts.formName}".`, '',
      opts.url, '',
      `The link works once and expires on ${expires}. Please don't forward it.`,
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;color:#111">
        <p>${escapeHtml(greeting)}</p>
        ${opts.message ? paragraphs(opts.message) : `<p>${escapeHtml(opts.senderName)} has asked you to fill in <strong>${escapeHtml(opts.formName)}</strong>.</p>`}
        ${opts.description ? `<p style="color:#555">${escapeHtml(opts.description)}</p>` : ''}
        <p><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open the form</a></p>
        <p style="color:#555;font-size:13px">The link works once and expires on ${escapeHtml(expires)}. Please don't forward it.</p>
      </div>`,
  })
}
