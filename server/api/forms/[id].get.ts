import { idParam, prisma } from '../../db/prisma'
import { formRow } from '../../utils/forms'

// The form with its draft and the list of published versions (schemas are fetched per version)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const form = await prisma.form.findUnique({
    where: { id: idParam(event, 'id') },
    include: {
      creator: { select: { username: true } },
      business: { select: { name: true } },
      versions: {
        orderBy: { version: 'desc' },
        select: { version: true, schema: true, published_at: true, publisher: { select: { username: true } } },
      },
    },
  })
  if (!form) throw createError({ statusCode: 404, message: 'Form not found' })

  return {
    ...formRow(form),
    versions: form.versions.map(v => ({
      version: v.version,
      published_at: v.published_at,
      published_by_username: v.publisher?.username ?? null,
      field_count: ((v.schema as { fields?: unknown[] })?.fields ?? []).length,
    })),
  }
})
