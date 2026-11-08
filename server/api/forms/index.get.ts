import { prisma } from '../../db/prisma'
import { formRow } from '../../utils/forms'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const query = getQuery(event)
  const archived = query.archived === '1'
  // ?business_id=: only the forms made for that company
  const businessId = Number(query.business_id) || undefined
  const forms = await prisma.form.findMany({
    where: { ...(archived ? { status: 'archived' } : { status: { not: 'archived' } }), ...(businessId ? { business_id: businessId } : {}) },
    orderBy: { updated_at: 'desc' },
    include: {
      creator: { select: { username: true } },
      business: { select: { name: true } },
      versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, schema: true, published_at: true } },
    },
  })
  return forms.map(f => ({ ...formRow(f), field_count: ((f.draft_schema as { fields?: unknown[] })?.fields ?? []).length }))
})
