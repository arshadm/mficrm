import { PromptsSchema } from '~/shared/ai'
import { prisma } from '../../db/prisma'

// Replaces the saved prompt list (Settings → Prompts, or "Save this question as a prompt")
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const parsed = PromptsSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid prompts' })
  await prisma.$transaction([
    prisma.aiPrompt.deleteMany({}),
    prisma.aiPrompt.createMany({ data: parsed.data.prompts.map((p, rank) => ({ ...p, rank })) }),
  ])
  return prisma.aiPrompt.findMany({ orderBy: [{ rank: 'asc' }, { id: 'asc' }], select: { id: true, name: true, text: true } })
})
