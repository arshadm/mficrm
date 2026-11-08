import { z } from 'zod'

// Forms built in the CRM (mficrm-xln). A form's schema is plain JSON stored in forms.draft_schema and, once
// published, in form_versions.schema. This module is shared by the builder, the renderer (preview and the public
// /f/* pages) and the server, which validates both definitions and submissions with it.

export const FORM_FIELD_TYPES = [
  'short_text', 'long_text', 'number', 'currency', 'email', 'phone', 'date',
  'single_select', 'multi_select', 'checkbox', 'file', 'section',
] as const
export type FormFieldType = typeof FORM_FIELD_TYPES[number]

export const FORM_FIELD_META: Record<FormFieldType, { label: string, icon: string }> = {
  short_text: { label: 'Short text', icon: 'lucide:type' },
  long_text: { label: 'Long text', icon: 'lucide:align-left' },
  number: { label: 'Number', icon: 'lucide:hash' },
  currency: { label: 'Currency', icon: 'lucide:dollar-sign' },
  email: { label: 'Email', icon: 'lucide:mail' },
  phone: { label: 'Phone', icon: 'lucide:phone' },
  date: { label: 'Date', icon: 'lucide:calendar' },
  single_select: { label: 'Single select', icon: 'lucide:circle-dot' },
  multi_select: { label: 'Multi select', icon: 'lucide:list-checks' },
  checkbox: { label: 'Checkbox', icon: 'lucide:square-check' },
  file: { label: 'File upload', icon: 'lucide:paperclip' },
  section: { label: 'Section heading', icon: 'lucide:heading' },
}

/** File types a form may accept. Active content (html, svg, js…) is never allowed (server/utils/files.ts). */
export const FORM_FILE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'] as const

export const FORM_LIMITS = {
  fields: 100,
  shortText: 500,
  longText: 10000,
  options: 100,
  maxFiles: 10,
  fileMb: 20,
}

export interface FormField {
  /** Stable key for answers; never changes once created, even if the label does. */
  id: string
  type: FormFieldType
  /** Question text, or the heading for a section */
  label: string
  /** Help text under the label, or the body text for a section */
  help?: string
  required?: boolean
  placeholder?: string
  /** single_select / multi_select */
  options?: string[]
  /** number / currency */
  min?: number
  max?: number
  /** file: accepted extensions (subset of FORM_FILE_EXTENSIONS) and file count */
  accept?: string[]
  maxFiles?: number
}

export interface FormSchema {
  fields: FormField[]
}

export function isInputField(field: FormField): boolean {
  return field.type !== 'section'
}

export function newFieldId(): string {
  return 'f_' + Math.random().toString(36).slice(2, 10)
}

export function newField(type: FormFieldType): FormField {
  const field: FormField = { id: newFieldId(), type, label: type === 'section' ? 'Section' : FORM_FIELD_META[type].label }
  if (type === 'single_select' || type === 'multi_select') field.options = ['Option 1', 'Option 2']
  if (type === 'file') {
    field.accept = ['.pdf', '.png', '.jpg', '.jpeg']
    field.maxFiles = 1
  }
  if (type === 'checkbox') field.label = 'I agree'
  return field
}

// ---------------------------------------------------------------------------------------------------------------
// Definitions: what the builder may save

const optionalText = (max: number) => z.string().trim().max(max).optional()

export const FormFieldDefSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Invalid field id'),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().trim().max(300),
  help: optionalText(2000),
  required: z.boolean().optional(),
  placeholder: optionalText(200),
  options: z.array(z.string().trim().min(1, 'Options cannot be empty').max(200)).max(FORM_LIMITS.options).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  accept: z.array(z.enum(FORM_FILE_EXTENSIONS)).optional(),
  maxFiles: z.number().int().min(1).max(FORM_LIMITS.maxFiles).optional(),
}).superRefine((f, ctx) => {
  if (f.type !== 'section' && !f.label) ctx.addIssue({ code: 'custom', path: ['label'], message: 'Every question needs a label' })
  if ((f.type === 'single_select' || f.type === 'multi_select')) {
    if (!f.options?.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least one option' })
    else if (new Set(f.options).size !== f.options.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Options must be unique' })
  }
  if (f.min !== undefined && f.max !== undefined && f.min > f.max) ctx.addIssue({ code: 'custom', path: ['max'], message: 'Maximum is below minimum' })
  if (f.type === 'file' && f.accept && !f.accept.length) ctx.addIssue({ code: 'custom', path: ['accept'], message: 'Choose at least one file type' })
})

export const FormSchemaDefSchema = z.object({
  fields: z.array(FormFieldDefSchema).max(FORM_LIMITS.fields),
}).superRefine((s, ctx) => {
  const ids = new Set<string>()
  s.fields.forEach((f, i) => {
    if (ids.has(f.id)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'id'], message: 'Duplicate field id' })
    ids.add(f.id)
  })
})

/** Extra checks before publishing: a form people can actually fill in. Returns problems as readable strings. */
export function publishProblems(schema: FormSchema): string[] {
  const parsed = FormSchemaDefSchema.safeParse(schema)
  const problems = parsed.success ? [] : parsed.error.issues.map((i) => {
    const idx = i.path[1]
    const field = typeof idx === 'number' ? schema.fields[idx] : undefined
    return field ? `${field.label || FORM_FIELD_META[field.type]?.label || 'Field'}: ${i.message}` : i.message
  })
  if (!schema.fields.some(isInputField)) problems.push('Add at least one question')
  return problems
}

// ---------------------------------------------------------------------------------------------------------------
// Submissions: answers to a published version

export type FormAnswerValue = string | number | boolean | string[] | null
export type FormAnswers = Record<string, FormAnswerValue>

const blankToUndefined = (v: unknown) =>
  v === '' || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim()) ? undefined : v

function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

function valueSchema(field: FormField): z.ZodType {
  switch (field.type) {
    case 'short_text': return z.string().trim().max(FORM_LIMITS.shortText)
    case 'long_text': return z.string().trim().max(FORM_LIMITS.longText)
    case 'email': return z.string().trim().max(254).pipe(z.email('Enter a valid email address'))
    case 'phone': return z.string().trim().regex(/^\+?[\d\s().-]{6,30}$/, 'Enter a valid phone number')
    case 'date': return z.string().refine(isValidDate, 'Enter a valid date')
    case 'number':
    case 'currency': {
      let n = z.coerce.number({ message: 'Enter a number' }).refine(Number.isFinite, 'Enter a number')
      if (field.min !== undefined) n = n.refine(v => v >= field.min!, `Must be at least ${field.min}`)
      if (field.max !== undefined) n = n.refine(v => v <= field.max!, `Must be at most ${field.max}`)
      return n
    }
    case 'single_select': {
      const options = field.options ?? []
      return z.string().refine(v => options.includes(v), 'Choose one of the options')
    }
    case 'multi_select': {
      const options = field.options ?? []
      return z.array(z.string().refine(v => options.includes(v), 'Choose from the options'))
        .refine(v => new Set(v).size === v.length, 'Duplicate choice')
    }
    case 'checkbox': return field.required ? z.literal(true, { message: 'This must be ticked' }) : z.boolean()
    // Stored-file references; the upload itself is checked by storeUpload()
    case 'file': return z.array(z.string().min(1)).max(field.maxFiles ?? 1, `At most ${field.maxFiles ?? 1} file(s)`)
    default: return z.never()
  }
}

/**
 * Builds the Zod schema that validates answers to a form version. Keys are field ids; unknown keys are dropped,
 * section headings take no answer, blank optional answers become absent.
 */
export function buildSubmissionSchema(schema: FormSchema) {
  const shape: Record<string, z.ZodType> = {}
  for (const field of schema.fields) {
    if (!isInputField(field)) continue
    const value = valueSchema(field)
    shape[field.id] = field.type === 'checkbox'
      ? (field.required ? value : z.preprocess(v => v ?? false, value))
      : field.required
        ? z.preprocess(blankToUndefined, value.optional()).refine(v => v !== undefined, 'This field is required')
        : z.preprocess(blankToUndefined, value.optional())
  }
  // Every field key is made present (undefined if unanswered): Zod skips absent keys whose schema accepts
  // undefined, which would bypass the required check
  const keys = Object.keys(shape)
  return z.preprocess(
    v => (v && typeof v === 'object' && !Array.isArray(v) ? { ...Object.fromEntries(keys.map(k => [k, undefined])), ...v } : v),
    z.object(shape).strip(),
  )
}

/** Validation errors keyed by field id, for showing next to each field. */
export function submissionErrors(schema: FormSchema, answers: FormAnswers): Record<string, string> {
  const result = buildSubmissionSchema(schema).safeParse(answers)
  if (result.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !errors[key]) errors[key] = issue.message
  }
  return errors
}
