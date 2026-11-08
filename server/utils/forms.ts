import type { FormSchema } from '~/shared/forms'
import { FormSchemaDefSchema } from '~/shared/forms'

/** Validates a form definition from the builder, 400 with readable messages otherwise. */
export function parseFormSchema(value: unknown): FormSchema {
  const parsed = FormSchemaDefSchema.safeParse(value)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid form', data: parsed.error.issues.map(i => ({ path: i.path, message: i.message })) })
  }
  return parsed.data as FormSchema
}

/** JSONB normalises key order, so stored schemas compare reliably as strings. */
export function sameSchema(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

type FormRow = {
  creator?: { username: string } | null
  business?: { name: string } | null
  versions?: { version: number, schema: unknown, published_at: Date }[]
  draft_schema: unknown
  [key: string]: unknown
}

/** Flattens a form with its creator and latest version into the API shape. */
export function formRow<T extends FormRow>(form: T) {
  const { creator, business, versions, ...rest } = form
  const latest = versions?.[0]
  return {
    ...rest,
    created_by_username: creator?.username ?? null,
    business_name: business?.name ?? null,
    latest_version: latest?.version ?? null,
    published_at: latest?.published_at ?? null,
    has_unpublished_changes: latest ? !sameSchema(form.draft_schema, latest.schema) : false,
  }
}
