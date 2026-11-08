import { idParam, prisma } from '../../db/prisma'

// Only never-published forms can be deleted; published ones may have links and submissions, so archive them instead
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'id')
  const form = await prisma.form.findUnique({ where: { id }, select: { _count: { select: { versions: true } } } })
  if (!form) throw createError({ statusCode: 404, message: 'Form not found' })
  if (form._count.versions) throw createError({ statusCode: 409, message: 'This form has been published. Archive it instead.' })

  await prisma.form.deleteMany({ where: { id } })
  return { success: true }
})
