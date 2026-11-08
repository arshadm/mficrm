import { idParam, prisma } from '../../../../db/prisma'
import Papa from 'papaparse'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'id')
  const business = await prisma.business.findUnique({ where: { id } })
  if (!business) throw createError({ statusCode: 404, message: 'Not found' })

  const activeStep = await prisma.nextStep.findFirst({
    where: { business_id: id, is_primary: true, status: 'pending' },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: { title: true, due_date: true },
  })

  const row = {
    ...business,
    next_step_title: activeStep?.title ?? null,
    next_step_due_date: activeStep?.due_date ?? null,
  }

  const csv = Papa.unparse([row])

  setHeader(event, 'Content-Type', 'text/csv')
  setHeader(event, 'Content-Disposition', `attachment; filename="business-${id}.csv"`)
  return csv
})
