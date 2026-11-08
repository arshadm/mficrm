import { idParam, prisma } from '../../../db/prisma'
import { sameSchema } from '../../../utils/forms'
import { publishProblems, type FormSchema } from '~/shared/forms'

// Snapshots the draft as the next version. Earlier versions are left exactly as they were.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'id')

  return prisma.$transaction(async (tx) => {
    // Row lock so two publishes can't race for the same version number
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM forms WHERE id = ${id} FOR UPDATE`
    if (!locked.length) throw createError({ statusCode: 404, message: 'Form not found' })

    const form = await tx.form.findUniqueOrThrow({
      where: { id },
      select: { status: true, draft_schema: true, versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, schema: true } } },
    })
    if (form.status === 'archived') throw createError({ statusCode: 409, message: 'Restore the form before publishing it' })

    const problems = publishProblems(form.draft_schema as unknown as FormSchema)
    if (problems.length) throw createError({ statusCode: 400, message: problems.join('; '), data: problems })

    const latest = form.versions[0]
    if (latest && sameSchema(latest.schema, form.draft_schema)) {
      throw createError({ statusCode: 409, message: `No changes since version ${latest.version}` })
    }

    const version = await tx.formVersion.create({
      data: { form_id: id, version: (latest?.version ?? 0) + 1, schema: form.draft_schema as object, published_by: session.user.id },
    })
    await tx.form.update({ where: { id }, data: { status: 'published', updated_at: new Date() } })
    return { version: version.version, published_at: version.published_at }
  })
})
