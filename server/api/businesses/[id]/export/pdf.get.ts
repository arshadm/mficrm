import { getDb } from '../../../../db/database'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = getRouterParam(event, 'id')
  const db = getDb()

  const business = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!business) throw createError({ statusCode: 404, message: 'Not found' })

  const activeStep = db.prepare(
    `SELECT title, due_date FROM next_steps WHERE business_id = ? AND is_primary = 1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`
  ).get(id) as { title: string, due_date: string } | undefined

  const valuation = db.prepare('SELECT * FROM valuation WHERE business_id = ?').get(id) as Record<string, unknown> | null
  const workingCapital = db.prepare('SELECT * FROM working_capital WHERE business_id = ?').get(id) as Record<string, unknown> | null
  const risks = db.prepare('SELECT * FROM risk_checklist WHERE business_id = ?').all(id) as Array<Record<string, unknown>>

  const PdfPrinter = (await import('pdfmake')).default
  const fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  }

  const printer = new PdfPrinter(fonts)

  const fmt = (v: unknown) => v != null ? String(v) : '—'
  const money = (v: unknown) => v != null ? `$${Number(v).toLocaleString()}` : '—'

  const docDef: TDocumentDefinitions = {
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    content: [
      { text: 'AcquireDesk — Business Summary', style: 'header' },
      { text: String(business['name']), style: 'title' },
      { text: `Stage: ${String(business['stage']).replace(/_/g, ' ')} | Category: ${fmt(business['category'])} | Platform: ${fmt(business['platform'])}`, margin: [0, 0, 0, 10] },
      { text: 'Financial Overview', style: 'section' },
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            ['Asking Price', 'T12M Revenue', 'T12M Profit', 'Revenue Multiple'],
            [money(business['asking_price']), money(business['trailing_12m_revenue']), money(business['trailing_12m_profit']), fmt(business['revenue_multiple'])],
          ],
        },
        margin: [0, 0, 0, 10],
      },
      ...(activeStep ? [
        { text: 'Active Next Step', style: 'section' },
        { text: `${activeStep.title}  |  Due: ${activeStep.due_date}`, margin: [0, 0, 0, 10] },
      ] : []),
      ...(valuation ? [
        { text: 'Valuation', style: 'section' },
        { text: `Method: ${fmt(valuation['valuation_method'])}  |  Low: ${money(valuation['estimated_value_low'])}  Mid: ${money(valuation['estimated_value_mid'])}  High: ${money(valuation['estimated_value_high'])}`, margin: [0, 0, 0, 4] },
        { text: `Initial Offer: ${money(valuation['initial_offer'])}  |  Max Offer: ${money(valuation['max_offer'])}  |  Final Offer: ${money(valuation['final_offer_made'])}`, margin: [0, 0, 0, 10] },
      ] : []),
      ...(workingCapital ? [
        { text: 'Working Capital', style: 'section' },
        { text: `Total Estimated: ${money(workingCapital['total_estimated'])}  |  Funding: ${fmt(workingCapital['funding_source'])}`, margin: [0, 0, 0, 10] },
      ] : []),
      ...(risks.length ? [
        { text: 'Risk Checklist', style: 'section' },
        {
          ul: risks.map(r => `[${r['is_resolved'] ? '✓' : ' '}] ${String(r['description'])}`),
          margin: [0, 0, 0, 10],
        },
      ] : []),
      { text: `Generated: ${new Date().toLocaleString()}`, style: 'footer' },
    ],
    styles: {
      header: { fontSize: 14, bold: true, color: '#3b82f6', margin: [0, 0, 0, 4] },
      title: { fontSize: 20, bold: true, margin: [0, 0, 0, 6] },
      section: { fontSize: 12, bold: true, margin: [0, 8, 0, 4], color: '#1e40af' },
      footer: { fontSize: 8, color: '#6b7280', margin: [0, 20, 0, 0] },
    },
  }

  const pdfDoc = printer.createPdfKitDocument(docDef)
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', resolve)
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })

  const buffer = Buffer.concat(chunks)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `attachment; filename="business-${id}.pdf"`)
  return buffer
})
