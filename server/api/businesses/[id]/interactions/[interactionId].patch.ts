import { getDb } from '../../../../db/database'
import { CreateInteractionSchema } from '~/shared/schemas'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const interactionId = getRouterParam(event, 'interactionId')
  const body = await readBody(event)
  const parsed = CreateInteractionSchema.partial().safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Validation error' })

  const db = getDb()
  const d = parsed.data
  const fields: string[] = []
  const values: (string | number | null)[] = []

  if (d.type !== undefined) { fields.push('type = ?'); values.push(d.type) }
  if (d.title !== undefined) { fields.push('title = ?'); values.push(d.title ?? null) }
  if (d.body !== undefined) { fields.push('body = ?'); values.push(d.body ?? null) }
  if (d.occurred_at !== undefined) { fields.push('occurred_at = ?'); values.push(d.occurred_at) }

  if (!fields.length) return db.prepare('SELECT * FROM interactions WHERE id = ?').get(interactionId)

  values.push(interactionId as string)
  db.prepare(`UPDATE interactions SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return db.prepare('SELECT * FROM interactions WHERE id = ?').get(interactionId)
})
