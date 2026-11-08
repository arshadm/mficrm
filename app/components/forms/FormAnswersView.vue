<script setup lang="ts">
import type { FormAnswers, FormField, FormSchema } from '~/shared/forms'

// Read-only answers, laid out against the form version they were given for (mficrm-xln.6). File answers link to
// the stored files, which only logged-in users can open.
interface StoredFile { id: number, filename: string, original_name: string, file_size: number | null }
const props = defineProps<{ schema: FormSchema, answers: FormAnswers, attachments: StoredFile[] }>()

const { formatMoney, formatDate } = useFormatting()
const byFilename = computed(() => new Map(props.attachments.map(a => [a.filename, a])))

function display(field: FormField): string | null {
  const v = props.answers[field.id]
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null
  switch (field.type) {
    case 'currency': return formatMoney(Number(v))
    case 'number': return Number(v).toLocaleString('en-GB')
    case 'date': return formatDate(String(v))
    case 'checkbox': return v ? 'Yes' : 'No'
    case 'multi_select': return (v as string[]).join(', ')
    default: return String(v)
  }
}
function files(field: FormField): StoredFile[] {
  const v = props.answers[field.id]
  return Array.isArray(v) ? v.map(name => byFilename.value.get(name)).filter((f): f is StoredFile => !!f) : []
}
</script>

<template>
  <dl class="space-y-4">
    <template v-for="field in schema.fields" :key="field.id">
      <div v-if="field.type === 'section'" class="pt-2 first:pt-0">
        <h3 class="text-base font-semibold">{{ field.label }}</h3>
        <div class="border-b mt-2" />
      </div>
      <div v-else :data-answer="field.id">
        <dt class="text-xs font-medium text-muted-foreground">{{ field.label }}</dt>
        <dd class="mt-0.5 text-sm">
          <template v-if="field.type === 'file'">
            <div v-if="files(field).length" class="space-y-1">
              <a
                v-for="f in files(field)"
                :key="f.id"
                :href="`/uploads/${f.filename}`"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Icon name="lucide:paperclip" class="h-3.5 w-3.5" />
                {{ f.original_name }}
                <span v-if="f.file_size" class="text-xs text-muted-foreground">({{ Math.max(1, Math.round(f.file_size / 1024)) }} KB)</span>
              </a>
            </div>
            <span v-else class="text-muted-foreground italic">No file</span>
          </template>
          <span v-else-if="display(field) !== null" class="whitespace-pre-line break-words">{{ display(field) }}</span>
          <span v-else class="text-muted-foreground italic">Not answered</span>
        </dd>
      </div>
    </template>
  </dl>
</template>
