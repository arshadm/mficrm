import { prisma } from '../../db/prisma'
import { sendFormLinkEmail, emailConfigured } from '../../utils/email'
import { formLinkUrl, formRequestInclude, formRequestRow, newFormToken } from '../../utils/formRequests'
import { CreateFormRequestSchema } from '~/shared/schemas'

// Creates a link to the form's latest published version. The raw URL is in this response only.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parsed = CreateFormRequestSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Validation error' })
  const d = parsed.data
  if (d.send_email && !emailConfigured()) throw createError({ statusCode: 400, message: 'Email is not configured on the server. Copy the link instead.' })

  const form = await prisma.form.findUnique({
    where: { id: d.form_id },
    select: { name: true, description: true, status: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true } } },
  })
  if (!form) throw createError({ statusCode: 404, message: 'Form not found' })
  if (form.status === 'archived') throw createError({ statusCode: 409, message: 'This form is archived' })
  if (!form.versions[0]) throw createError({ statusCode: 409, message: 'Publish the form before sending it' })
  if (d.business_id && !(await prisma.business.count({ where: { id: d.business_id } }))) {
    throw createError({ statusCode: 404, message: 'Business not found' })
  }

  const { token, hash } = newFormToken()
  const expires_at = new Date(Date.now() + d.expires_in_days * 24 * 60 * 60 * 1000)
  const created = await prisma.formRequest.create({
    data: {
      form_id: d.form_id,
      form_version_id: form.versions[0].id,
      business_id: d.business_id || null,
      recipient_name: d.recipient_name || null,
      recipient_email: d.recipient_email || null,
      token_hash: hash,
      expires_at,
      created_by: session.user.id,
    },
    include: formRequestInclude,
  })
  const url = formLinkUrl(event, token)

  // The link exists either way; an email failure is reported so the user can copy the link instead
  let email_error: string | null = null
  let row = created
  if (d.send_email && d.recipient_email) {
    try {
      await sendFormLinkEmail({
        to: d.recipient_email, recipientName: d.recipient_name, formName: form.name, description: form.description,
        message: d.message, url, expiresAt: expires_at, senderName: session.user.username,
      })
      row = await prisma.formRequest.update({ where: { id: created.id }, data: { emailed_at: new Date() }, include: formRequestInclude })
    } catch (err) {
      console.error('[form-requests] email failed', err)
      email_error = 'The link was created but the email could not be sent. Copy the link and send it yourself.'
    }
  }

  return { ...formRequestRow(row), url, email_error }
})
