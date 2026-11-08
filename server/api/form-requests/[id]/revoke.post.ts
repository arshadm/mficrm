import { idParam, prisma } from '../../../db/prisma'
import { formRequestInclude, formRequestRow } from '../../../utils/formRequests'

// Stops a link working. Submitted links stay as they are (the submission is kept).
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const id = idParam(event, 'id')
  const { count } = await prisma.formRequest.updateMany({
    where: { id, status: { in: ['sent', 'opened'] } },
    data: { status: 'revoked', revoked_at: new Date() },
  })
  const row = await prisma.formRequest.findUnique({ where: { id }, include: formRequestInclude })
  if (!row) throw createError({ statusCode: 404, message: 'Link not found' })
  if (!count && row.status !== 'revoked') throw createError({ statusCode: 409, message: 'This link has already been submitted' })
  return formRequestRow(row)
})
