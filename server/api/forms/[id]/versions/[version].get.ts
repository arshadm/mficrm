import { idParam, prisma } from '../../../../db/prisma'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const row = await prisma.formVersion.findUnique({
    where: { form_id_version: { form_id: idParam(event, 'id'), version: idParam(event, 'version') } },
    select: { version: true, schema: true, published_at: true, publisher: { select: { username: true } } },
  })
  if (!row) throw createError({ statusCode: 404, message: 'Version not found' })
  return { version: row.version, schema: row.schema, published_at: row.published_at, published_by_username: row.publisher?.username ?? null }
})
