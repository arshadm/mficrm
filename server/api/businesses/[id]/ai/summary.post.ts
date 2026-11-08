import { AiSummarySchema } from '~/shared/ai'
import { idParam, prisma } from '../../../../db/prisma'
import { aiStructured, businessContext, businessForAi, firstTurn, loadBusinessDocuments } from '../../../../utils/ai'
import { aiRateLimit } from '../../../../utils/aiLimits'

// Summarises a company's documents (mficrm-b6g.5) and stores the summary on the business
export default defineEventHandler(async (event) => {
  await aiRateLimit(event)
  const id = idParam(event, 'id')
  const business = await businessForAi(id)
  const docs = await loadBusinessDocuments(id)
  if (!docs.blocks.length) throw createError({ statusCode: 422, message: 'Add documents to this company first (the listing PDF or P&L accounts)' })

  const summary = await aiStructured([firstTurn(docs, businessContext(business), `Summarise this company for a buyer deciding whether to pursue it.

Be concrete: quote figures with their period (e.g. "Revenue $412k, Oct 2025 to Sep 2026"). Compute margin and the asking multiple of annual profit when the figures allow, showing the basis. Point out where the listing and the P&L disagree. Keep each list item to one or two sentences, and leave a list empty rather than padding it.`)], AiSummarySchema, 8000)

  const saved = await prisma.business.update({
    where: { id },
    data: { ai_summary: JSON.stringify(summary), ai_summary_at: new Date() },
    select: { ai_summary_at: true },
  })
  return { summary, ai_summary_at: saved.ai_summary_at, included: docs.included, skipped: docs.skipped }
})
