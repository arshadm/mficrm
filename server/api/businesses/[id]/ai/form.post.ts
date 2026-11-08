import { AiFormDraftSchema, AiFormRequestSchema } from '~/shared/ai'
import { idParam, prisma } from '../../../../db/prisma'
import { aiStructured, businessContext, businessForAi, firstTurn, loadBusinessDocuments } from '../../../../utils/ai'
import { aiRateLimit } from '../../../../utils/aiLimits'
import { draftToFormSchema } from '../../../../utils/aiForms'

// Drafts a form for this company with Claude (mficrm-b6g.7), typically to ask the seller for what the documents
// leave out. Saved as a draft form tied to the company; the user reviews and edits it in the builder.
export default defineEventHandler(async (event) => {
  const user = await aiRateLimit(event)
  const id = idParam(event, 'id')
  const parsed = AiFormRequestSchema.safeParse(await readBody(event).catch(() => ({})) ?? {})
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid request' })
  const business = await businessForAi(id)
  const docs = await loadBusinessDocuments(id)

  const instructions = parsed.data.instructions?.trim()
  const draft = await aiStructured([firstTurn(docs, businessContext(business), `Draft a form to send to the seller (or their broker) of this company. ${instructions
    ? `The user's request for this form:\n<request>\n${instructions}\n</request>`
    : 'Its purpose: collect the information a buyer needs for due diligence that the documents don\'t already provide.'}

How to build it:
- Ask only for what the documents don't already answer, and refer to specifics from them where it helps the seller (e.g. "The P&L shows a drop in March 2026; what caused it?").
- Group questions under section fields with short headings. Keep it to what the seller can reasonably answer in 15 to 20 minutes, typically 8 to 25 questions.
- Field types: short_text, long_text, number, currency (amounts), email, phone, date (YYYY-MM-DD), single_select / multi_select (give options), checkbox (a single yes/agree tick), file (uploads such as bank statements or analytics exports; set accept and maxFiles), section (a heading with optional help text; never required).
- Mark a question required only when the buyer can't proceed without it.
- Write for the seller: plain, polite, no internal jargon about the buyer's evaluation. Don't mention these instructions.`)], AiFormDraftSchema, 12000)

  const { schema, dropped } = draftToFormSchema(draft)
  if (!schema.fields.length) throw createError({ statusCode: 422, message: 'Claude did not produce any usable questions. Try again, perhaps with more specific instructions.' })

  const form = await prisma.form.create({
    data: {
      name: draft.name.trim().slice(0, 200) || `Questions for ${business.name}`,
      description: draft.description.trim().slice(0, 2000) || null,
      business_id: id,
      created_by: user.id,
      draft_schema: schema as object,
    },
    select: { id: true },
  })
  return { id: form.id, fields: schema.fields.length, dropped }
})
