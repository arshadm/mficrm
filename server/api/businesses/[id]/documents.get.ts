import { extname } from 'node:path'
import { idParam, prisma } from '../../../db/prisma'
import { DOCUMENT_EXTENSIONS } from '../../../utils/files'

// A company's documents: business-level attachments (not on a timeline entry or a form submission)
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const rows = await prisma.attachment.findMany({
    where: { business_id: idParam(event, 'id'), interaction_id: null, form_submission_id: null },
    orderBy: { uploaded_at: 'asc' },
    select: { id: true, filename: true, original_name: true, mime_type: true, file_size: true, uploaded_at: true },
  })
  // Images pasted into the notes are attachments too, but not documents
  return rows.filter(r => DOCUMENT_EXTENSIONS.includes(extname(r.original_name || r.filename).toLowerCase()))
})
