import { prisma } from '../db/prisma'

export const NOTES_MAX_CHARS = 1_000_000

/** A company's notes in the API shape (empty, version 0, when none have been written). */
export async function notesRow(businessId: number) {
  const note = await prisma.businessNote.findUnique({
    where: { business_id: businessId },
    include: { editor: { select: { username: true } } },
  })
  return {
    content: note?.content ?? '',
    version: note?.version ?? 0,
    updated_at: note?.updated_at ?? null,
    updated_by_username: note?.editor?.username ?? null,
  }
}
