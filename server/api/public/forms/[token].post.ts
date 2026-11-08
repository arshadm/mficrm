import { extname } from 'path'
import { prisma } from '../../../db/prisma'
import { clientIp } from '../../../utils/loginRateLimit'
import { rateLimit } from '../../../utils/rateLimit'
import { removeUpload, storeUpload, type StoredFile } from '../../../utils/files'
import { escapeHtml } from '../../../utils/html'
import { assertUsable, findLink, noStore, PUBLIC_LIMITS } from '../../../utils/publicForms'
import { buildSubmissionSchema, FORM_FILE_EXTENSIONS, submissionErrors, type FormAnswers } from '~/shared/forms'

// Submits a form link: one multipart request with an "answers" JSON part and files in parts named "file:<fieldId>".
// Answers are validated against the link's own form version; the link locks after one successful submission.
export default defineEventHandler(async (event) => {
  noStore(event)
  const ip = clientIp(event)
  rateLimit(event, `pub:submit:${ip}`, PUBLIC_LIMITS.submitsPerIp, 15 * 60 * 1000)

  // Size check before reading anything (the multipart parser buffers the whole body)
  const length = Number(getRequestHeader(event, 'content-length'))
  if (!length) throw createError({ statusCode: 411, message: 'Content-Length required' })
  if (length > PUBLIC_LIMITS.submissionBytes) {
    throw createError({ statusCode: 413, message: `The upload is too large (limit ${PUBLIC_LIMITS.submissionBytes / 1024 / 1024} MB in total)` })
  }
  if (!getRequestHeader(event, 'content-type')?.startsWith('multipart/form-data')) {
    throw createError({ statusCode: 415, message: 'Expected multipart/form-data' })
  }

  const link = await findLink(event)
  rateLimit(event, `pub:submit:token:${link.token_hash}`, PUBLIC_LIMITS.submitsPerToken, 15 * 60 * 1000)
  assertUsable(link)

  const parts = (await readMultipartFormData(event)) ?? []
  const answersPart = parts.find(p => p.name === 'answers' && !p.filename)
  let answers: FormAnswers = {}
  try {
    const parsed = answersPart ? JSON.parse(answersPart.data.toString('utf8')) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) answers = parsed
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid answers' })
  }

  // Files: only for file fields of this version, within each field's count and type rules
  const fileFields = new Map(link.schema.fields.filter(f => f.type === 'file').map(f => [f.id, f]))
  const filesByField = new Map<string, typeof parts>()
  for (const part of parts) {
    if (!part.name?.startsWith('file:') || !part.filename) continue
    const fieldId = part.name.slice(5)
    const field = fileFields.get(fieldId)
    if (!field) throw createError({ statusCode: 400, message: 'Unexpected file' })
    const accept = field.accept?.length ? field.accept : [...FORM_FILE_EXTENSIONS]
    if (!accept.includes(extname(part.filename).toLowerCase())) {
      throw createError({ statusCode: 400, message: `${part.filename}: this file type is not accepted`, data: { errors: { [fieldId]: `Accepted types: ${accept.join(', ')}` } } })
    }
    filesByField.set(fieldId, [...(filesByField.get(fieldId) ?? []), part])
  }
  // A file answer is whatever was actually uploaded, never what the client claims
  for (const id of fileFields.keys()) answers[id] = (filesByField.get(id) ?? []).map(p => p.filename!)

  const result = buildSubmissionSchema(link.schema).safeParse(answers)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Please check the highlighted answers', data: { errors: submissionErrors(link.schema, answers) } })
  }
  const clean = result.data as FormAnswers

  // Store files, then record everything in one transaction that also locks the link
  const stored: (StoredFile & { fieldId: string })[] = []
  try {
    for (const [fieldId, fileParts] of filesByField) {
      const field = fileFields.get(fieldId)!
      for (const part of fileParts) {
        stored.push({ fieldId, ...(await storeUpload(part, { allowedExtensions: field.accept?.length ? field.accept : [...FORM_FILE_EXTENSIONS] })) })
      }
      clean[fieldId] = stored.filter(s => s.fieldId === fieldId).map(s => s.filename)
    }

    await prisma.$transaction(async (tx) => {
      const now = new Date()
      const locked = await tx.formRequest.updateMany({
        where: { id: link.id, status: { in: ['sent', 'opened'] }, expires_at: { gt: now } },
        data: { status: 'submitted', submitted_at: now },
      })
      // Lost a race with another submission (or the link was revoked meanwhile)
      if (!locked.count) throw createError({ statusCode: 410, message: 'This form has already been submitted or the link is no longer active.', data: { reason: 'submitted' } })

      const submission = await tx.formSubmission.create({
        data: {
          form_request_id: link.id,
          answers: clean as object,
          ip,
          user_agent: getRequestHeader(event, 'user-agent')?.slice(0, 500) ?? null,
        },
      })
      // On the linked business's timeline, with the uploaded files attached to that entry
      let interaction_id: number | null = null
      if (link.business_id) {
        const who = link.recipient_name || link.recipient_email
        const interaction = await tx.interaction.create({
          data: {
            business_id: link.business_id,
            type: 'form_submission',
            title: `Form submitted: ${link.form.name}`,
            body: `<p>${who ? `${escapeHtml(who)} submitted` : 'Submitted'} <strong>${escapeHtml(link.form.name)}</strong>. `
              + `<a href="/forms/submissions/${submission.id}">View answers</a></p>`,
            occurred_at: now,
            created_at: now,
          },
        })
        interaction_id = interaction.id
      }
      if (stored.length) {
        await tx.attachment.createMany({
          data: stored.map(({ fieldId: _f, ...file }) => ({ ...file, business_id: link.business_id, form_submission_id: submission.id, interaction_id })),
        })
      }
    })
  } catch (err) {
    await Promise.all(stored.map(s => removeUpload(s.filename)))
    throw err
  }

  return { ok: true }
})
