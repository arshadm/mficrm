import { idParam, prisma } from '../../db/prisma'

// One submission with the form version it answered, for the read-only view (mficrm-xln.6)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const s = await prisma.formSubmission.findUnique({
    where: { id: idParam(event, 'id') },
    select: {
      id: true, answers: true, submitted_at: true,
      attachments: { select: { id: true, filename: true, original_name: true, mime_type: true, file_size: true } },
      form_request: {
        select: {
          id: true, form_id: true, business_id: true, recipient_name: true, recipient_email: true, created_at: true,
          form: { select: { name: true } },
          form_version: { select: { version: true, schema: true } },
          business: { select: { name: true } },
          creator: { select: { username: true } },
        },
      },
    },
  })
  if (!s) throw createError({ statusCode: 404, message: 'Submission not found' })

  const r = s.form_request
  return {
    id: s.id,
    submitted_at: s.submitted_at,
    answers: s.answers,
    attachments: s.attachments,
    form_request_id: r.id,
    form_id: r.form_id,
    form_name: r.form.name,
    version: r.form_version.version,
    schema: r.form_version.schema,
    business_id: r.business_id,
    business_name: r.business?.name ?? null,
    recipient_name: r.recipient_name,
    recipient_email: r.recipient_email,
    link_created_at: r.created_at,
    link_created_by_username: r.creator?.username ?? null,
  }
})
