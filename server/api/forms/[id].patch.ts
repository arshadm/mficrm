import { idParam, prisma } from '../../db/prisma'
import { formRow, parseFormSchema } from '../../utils/forms'
import { UpdateFormSchema } from '~/shared/schemas'

// Saves the draft (and name/description). Published versions are never touched here; see publish.post.ts.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'id')
  const parsed = UpdateFormSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Validation error' })
  const d = parsed.data

  const existing = await prisma.form.findUnique({ where: { id }, select: { _count: { select: { versions: true } } } })
  if (!existing) throw createError({ statusCode: 404, message: 'Form not found' })

  const status = d.archived === undefined ? undefined : d.archived ? 'archived' : existing._count.versions ? 'published' : 'draft'

  const form = await prisma.form.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description === undefined ? undefined : d.description || null,
      draft_schema: d.draft_schema === undefined ? undefined : (parseFormSchema(d.draft_schema) as object),
      status,
      updated_at: new Date(),
    },
    include: {
      creator: { select: { username: true } },
      business: { select: { name: true } },
      versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, schema: true, published_at: true } },
    },
  })
  return formRow(form)
})
