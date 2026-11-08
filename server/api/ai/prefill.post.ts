import { extname } from 'node:path'
import { AiPrefillSchema } from '~/shared/ai'
import { BusinessCategoryEnum } from '~/shared/schemas'
import { aiStructured, buildDocuments, firstTurn } from '../../utils/ai'
import { aiRateLimit } from '../../utils/aiLimits'
import { DOCUMENT_EXTENSIONS, MAX_UPLOAD_BYTES } from '../../utils/files'

// Prefill for the new-company form (mficrm-b6g.4): reads the chosen documents (not stored; the company doesn't
// exist yet) and returns the details Claude found in them.
export default defineEventHandler(async (event) => {
  await aiRateLimit(event)

  const parts = ((await readMultipartFormData(event)) ?? []).filter(p => p.filename)
  if (!parts.length) throw createError({ statusCode: 400, message: 'Choose at least one document' })
  for (const p of parts) {
    if (!DOCUMENT_EXTENSIONS.includes(extname(p.filename!).toLowerCase())) throw createError({ statusCode: 400, message: `${p.filename} is not a PDF, CSV or Excel file` })
    if (p.data.length > MAX_UPLOAD_BYTES) throw createError({ statusCode: 400, message: `${p.filename} exceeds the 20 MB limit` })
  }

  const docs = buildDocuments(parts.map(p => ({ name: p.filename!.slice(0, 255), data: p.data })))
  if (!docs.blocks.length) throw createError({ statusCode: 422, message: `None of the documents could be read (${docs.skipped.map(s => `${s.name}: ${s.reason}`).join('; ')})` })

  const fields = await aiStructured([firstTurn(docs, `Fill in the details for a new company record from these documents.

- asking_price, trailing_12m_revenue and trailing_12m_profit are plain numbers in the listing's currency, with no symbols. Use the most recent 12 months shown; if the P&L covers a different period, compute the trailing 12 months from the monthly figures when you can, and say so in notes.
- Profit means net profit (after expenses), as sellers usually report it on these marketplaces.
- category: the closest of the allowed values; "other" if none fits.
- date_listed: only if a listing date is stated.
- Use null for anything the documents don't state. Don't invent a listing URL.
- notes: short points the user should check, such as figures that disagree between the listing and the P&L.`)], AiPrefillSchema, 4000)

  // Only values the form accepts
  if (fields.category && !BusinessCategoryEnum.safeParse(fields.category).success) fields.category = null
  if (fields.date_listed && !/^\d{4}-\d{2}-\d{2}$/.test(fields.date_listed)) fields.date_listed = null
  return { fields, included: docs.included, skipped: docs.skipped }
})
