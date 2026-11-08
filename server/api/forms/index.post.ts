import { orNotFound, prisma } from '../../db/prisma'
import { CreateFormSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parsed = CreateFormSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Validation error' })

  return orNotFound(prisma.form.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      business_id: parsed.data.business_id ?? null,
      created_by: session.user.id,
      draft_schema: { fields: [] },
    },
  }), 'Business not found')
})
