import type { FormKitNode, FormKitSchemaNode } from '@formkit/core'
import { FORM_LIMITS, type FormField, type FormSchema } from '~/shared/forms'

// Converts a CRM form schema (app/shared/forms.ts) into a FormKit schema (mficrm-b6g.1). The CRM schema stays the
// stored format; this is only how it is rendered and validated in the browser. The server validates submissions
// separately with buildSubmissionSchema().
//
// Every user-supplied string (labels, help, options…, possibly drafted by Claude) is passed under a `__raw__` key:
// FormKit otherwise evaluates strings that start with `$` as expressions.

export const PHONE_PATTERN = /^\+?[\d\s().-]{6,30}$/

type Rule = [string, ...unknown[]]

/** FormKit file inputs hold [{ name, file }] */
export interface FormKitFileItem { name: string, file?: File }

// Custom rule for file inputs: every chosen file within the per-file size limit
const filesizeRule = (node: FormKitNode) =>
  !Array.isArray(node.value) || (node.value as FormKitFileItem[]).every(f => !f.file || f.file.size <= FORM_LIMITS.fileMb * 1024 * 1024)

// Plain wording, matching the server's messages (FormKit's defaults build sentences from the label)
function messages(field: FormField): Record<string, string> {
  return {
    required: 'This field is required.',
    accepted: 'This must be ticked.',
    email: 'Enter a valid email address.',
    matches: 'Enter a valid phone number.',
    number: 'Enter a number.',
    min: `Must be at least ${field.min}.`,
    max: `Must be at most ${field.max}.`,
    length: `Must be at most ${field.type === 'long_text' ? FORM_LIMITS.longText : FORM_LIMITS.shortText} characters.`,
  }
}

function rules(field: FormField): Rule[] {
  const list: Rule[] = []
  if (field.required) list.push([field.type === 'checkbox' ? 'accepted' : 'required'])
  switch (field.type) {
    case 'short_text': list.push(['length', 0, FORM_LIMITS.shortText]); break
    case 'long_text': list.push(['length', 0, FORM_LIMITS.longText]); break
    case 'email': list.push(['email']); break
    case 'phone': list.push(['matches', PHONE_PATTERN]); break
    case 'number':
    case 'currency':
      list.push(['number'])
      if (field.min !== undefined) list.push(['min', field.min])
      if (field.max !== undefined) list.push(['max', field.max])
      break
    case 'file':
      list.push(['length', 0, field.maxFiles ?? 1], ['filesize'])
      break
  }
  return list
}

const INPUT_TYPE: Record<string, string> = {
  short_text: 'text', long_text: 'textarea', email: 'email', phone: 'tel', date: 'date',
  number: 'number', currency: 'number', single_select: 'select', multi_select: 'checkbox', checkbox: 'checkbox', file: 'file',
}

function fieldNode(field: FormField): FormKitSchemaNode {
  if (field.type === 'section') {
    return { $cmp: 'FormSectionHeading', props: { __raw__title: field.label, __raw__body: field.help ?? '' } } as FormKitSchemaNode
  }
  const node: Record<string, unknown> = {
    $formkit: INPUT_TYPE[field.type],
    name: field.id,
    id: `ff-${field.id}`,
    __raw__label: field.label + (field.required ? ' *' : ''),
    validation: rules(field),
    // Errors show after the first submit attempt, then update as answers change
    validationVisibility: 'submit',
    validationMessages: messages(field),
  }
  if (field.help) node.__raw__help = field.help
  if (field.placeholder && field.type !== 'single_select') node.__raw__placeholder = field.placeholder
  switch (field.type) {
    case 'email': node.autocomplete = 'email'; break
    case 'phone': node.autocomplete = 'tel'; break
    case 'number': node.step = 'any'; node.inputmode = 'decimal'; break
    case 'currency':
      node.step = '0.01'
      node.inputmode = 'decimal'
      // A one-character "$" is not an expression
      node.sectionsSchema = { prefix: { $el: 'span', children: '$' } }
      node.inputClass = 'pl-7'
      break
    case 'single_select':
      node.__raw__placeholder = field.placeholder || 'Select…'
      node.__raw__options = field.options ?? []
      break
    case 'multi_select': node.__raw__options = field.options ?? []; break
    case 'file':
      node.__raw__accept = (field.accept ?? []).join(',')
      node.multiple = (field.maxFiles ?? 1) > 1
      node.validationRules = { filesize: filesizeRule }
      node.validationMessages = {
        ...messages(field),
        filesize: `Each file must be ${FORM_LIMITS.fileMb} MB or smaller`,
        length: `Choose at most ${field.maxFiles ?? 1} file${(field.maxFiles ?? 1) > 1 ? 's' : ''}`,
      }
      node.__raw__help = [field.help, `${(field.accept ?? []).join(', ')} · up to ${field.maxFiles ?? 1} file${(field.maxFiles ?? 1) > 1 ? 's' : ''}, ${FORM_LIMITS.fileMb} MB each`].filter(Boolean).join('\n')
      break
  }
  if (field.type === 'number' || field.type === 'currency') {
    if (field.min !== undefined) node.min = field.min
    if (field.max !== undefined) node.max = field.max
  }
  return node as FormKitSchemaNode
}

export function toFormKitSchema(schema: FormSchema): FormKitSchemaNode[] {
  return schema.fields.map(fieldNode)
}
