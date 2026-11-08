import { idParam, prisma } from '../../../db/prisma'
import { notesRow } from '../../../utils/notes'

// The company's shared notes (mficrm-bwv.1)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const id = idParam(event, 'id')
  if (!(await prisma.business.count({ where: { id } }))) throw createError({ statusCode: 404, message: 'Business not found' })
  return notesRow(id)
})
