import { PrismaPg } from '@prisma/adapter-pg'
import type { H3Event } from 'h3'
import { PrismaClient } from '../generated/prisma/client'

// Postgres @db.Date columns come back from Prisma as Date objects at UTC midnight. The API has always returned them
// as 'YYYY-MM-DD' strings (date inputs and the due-date logic in the frontend depend on it), so this extension
// converts them on read. On write, pass them through toDate().
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) }).$extends({
    result: {
      business: {
        date_listed: { needs: { date_listed: true }, compute: b => ymd(b.date_listed) },
        follow_up_date: { needs: { follow_up_date: true }, compute: b => ymd(b.follow_up_date) },
      },
      nextStep: {
        due_date: { needs: { due_date: true }, compute: s => ymd(s.due_date) as string },
      },
    },
  })
}

export type Db = ReturnType<typeof createPrismaClient>

// Reuse one client across dev hot reloads
const globalForPrisma = globalThis as unknown as { __prisma?: Db }
export const prisma = globalForPrisma.__prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma

/** 'YYYY-MM-DD' (or a full ISO string) → Date for a @db.Date column. Empty or missing → null. */
export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(d.getTime())) throw createError({ statusCode: 400, message: `Invalid date: ${value}` })
  return d
}

/** Today's date (server time, UTC) as a Date for comparing against @db.Date columns. */
export function today(): Date {
  return toDate(new Date().toISOString().slice(0, 10))!
}

/** A numeric route parameter. Anything else is a 404, as an unknown id would be. */
export function idParam(event: H3Event, name: string): number {
  const raw = getRouterParam(event, name)
  const id = Number(raw)
  if (!raw || !Number.isSafeInteger(id) || id <= 0) throw createError({ statusCode: 404, message: 'Not found' })
  return id
}

/** Prisma error code for a record that doesn't exist (update/delete of a missing row). */
export function isNotFound(err: unknown): boolean {
  return (err as { code?: string })?.code === 'P2025'
}

/** Runs a write for a business's child row, turning "no such business/row" errors into a 404. */
export async function orNotFound<T>(write: Promise<T>, message = 'Not found'): Promise<T> {
  try {
    return await write
  } catch (err) {
    // P2025: row to update/delete is missing; P2003: foreign key (e.g. business_id) points at nothing
    const code = (err as { code?: string })?.code
    if (code === 'P2025' || code === 'P2003') throw createError({ statusCode: 404, message })
    throw err
  }
}
