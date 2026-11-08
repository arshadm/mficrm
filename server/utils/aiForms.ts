import type { AiFormDraft } from '~/shared/ai'
import { FORM_FIELD_TYPES, FORM_FILE_EXTENSIONS, FORM_LIMITS, FormFieldDefSchema, type FormField, type FormFieldType, type FormSchema } from '~/shared/forms'

// Turns Claude's form draft into a FormSchema the builder accepts (mficrm-b6g.7): stable ids, nulls dropped,
// type-specific properties kept only where they apply. Fields that still fail the definition check are dropped
// and counted, rather than failing the whole draft.
export function draftToFormSchema(draft: AiFormDraft): { schema: FormSchema, dropped: number } {
  const used = new Set<string>()
  const fields: FormField[] = []
  let dropped = 0
  for (const raw of draft.fields.slice(0, FORM_LIMITS.fields)) {
    if (!(FORM_FIELD_TYPES as readonly string[]).includes(raw.type)) {
      dropped++
      continue
    }
    const type = raw.type as FormFieldType
    const base = raw.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || raw.type
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}_${n}`
    const field: FormField = { id, type, label: raw.label.trim() }
    if (raw.help?.trim()) field.help = raw.help.trim()
    if (raw.type !== 'section') {
      if (raw.required) field.required = true
      if (raw.placeholder?.trim() && raw.type !== 'checkbox' && raw.type !== 'file' && raw.type !== 'multi_select') field.placeholder = raw.placeholder.trim()
    }
    if (raw.type === 'single_select' || raw.type === 'multi_select') field.options = [...new Set((raw.options ?? []).map(o => o.trim()).filter(Boolean))]
    if (raw.type === 'number' || raw.type === 'currency') {
      if (raw.min != null) field.min = raw.min
      if (raw.max != null) field.max = raw.max
    }
    if (raw.type === 'file') {
      const accept = [...new Set((raw.accept ?? []).map(a => a.toLowerCase().trim()).map(a => a.startsWith('.') ? a : `.${a}`))]
        .filter(a => (FORM_FILE_EXTENSIONS as readonly string[]).includes(a)) as NonNullable<FormField['accept']>
      field.accept = accept.length ? accept : ['.pdf', '.png', '.jpg', '.jpeg']
      field.maxFiles = Math.min(Math.max(raw.maxFiles ?? 1, 1), FORM_LIMITS.maxFiles)
    }
    if (FormFieldDefSchema.safeParse(field).success) {
      used.add(id)
      fields.push(field)
    } else {
      dropped++
    }
  }
  return { schema: { fields }, dropped }
}
