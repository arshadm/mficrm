import { prisma } from '../../db/prisma'
import { formRequestInclude, formRequestRow } from '../../utils/formRequests'

// Links, newest first, optionally for one business or one form
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const q = getQuery(event)
  const num = (v: unknown) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined)
  const rows = await prisma.formRequest.findMany({
    where: { business_id: num(q.business_id), form_id: num(q.form_id) },
    orderBy: { created_at: 'desc' },
    take: 200,
    include: formRequestInclude,
  })
  return rows.map(formRequestRow)
})
