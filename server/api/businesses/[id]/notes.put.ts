import { z } from 'zod'
import { idParam, prisma } from '../../../db/prisma'
import { sanitizeNotes } from '../../../utils/html'
import { NOTES_MAX_CHARS, notesRow } from '../../../utils/notes'

const Body = z.object({
  content: z.string().max(NOTES_MAX_CHARS, 'The notes are too long'),
  // The version the edit started from; refused with 409 if someone saved since
  base_version: z.number().int().min(0),
})

// Saves the company's notes (mficrm-bwv.1). A save from an out-of-date version gets 409 with the current notes,
// so the editor can take them in instead of overwriting someone else's changes.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const business_id = idParam(event, 'id')
  const parsed = Body.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid notes' })
  const { content, base_version } = parsed.data
  const clean = sanitizeNotes(content)
  const data = { content: clean, updated_at: new Date(), updated_by: session.user.id }

  let saved = false
  if (base_version === 0) {
    // First save: create, unless someone else just did
    try {
      await prisma.businessNote.create({ data: { ...data, business_id, version: 1 } })
      saved = true
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'P2003') throw createError({ statusCode: 404, message: 'Business not found' })
      if (code !== 'P2002') throw err
    }
  } else {
    const result = await prisma.businessNote.updateMany({
      where: { business_id, version: base_version },
      data: { ...data, version: { increment: 1 } },
    })
    saved = result.count === 1
  }

  const current = await notesRow(business_id)
  if (!saved) throw createError({ statusCode: 409, message: 'Someone else changed the notes', data: current })
  return current
})
