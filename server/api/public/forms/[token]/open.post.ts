import { prisma } from '../../../../db/prisma'
import { findLink, noStore } from '../../../../utils/publicForms'

// Marks a link as opened. Called by the page's script after it loads, so link scanners that fetch the URL (mail
// security filters) don't count as an open.
export default defineEventHandler(async (event) => {
  noStore(event)
  const link = await findLink(event)
  await prisma.formRequest.updateMany({
    where: { id: link.id, status: 'sent', expires_at: { gt: new Date() } },
    data: { status: 'opened', opened_at: new Date() },
  })
  return { ok: true }
})
