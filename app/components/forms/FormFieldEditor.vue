<script setup lang="ts">
import type { FormField } from '~/shared/forms'
import { FORM_FIELD_META, FORM_FILE_EXTENSIONS, FORM_LIMITS } from '~/shared/forms'

// Edits one field's settings in the form builder. Mutates a copy and emits it, so the parent owns the schema.
const props = defineProps<{ field: FormField }>()
const emit = defineEmits<{ update: [FormField] }>()

function patch(changes: Partial<FormField>) {
  const next = { ...props.field, ...changes }
  // Drop empty optional values so the stored schema stays tidy
  for (const key of ['help', 'placeholder'] as const) if (!next[key]) delete next[key]
  for (const key of ['min', 'max'] as const) if (next[key] === undefined || Number.isNaN(next[key])) delete next[key]
  if (!next.required) delete next.required
  emit('update', next)
}

const isSection = computed(() => props.field.type === 'section')
const hasOptions = computed(() => props.field.type === 'single_select' || props.field.type === 'multi_select')
const hasPlaceholder = computed(() => ['short_text', 'long_text', 'number', 'currency', 'email', 'phone', 'single_select'].includes(props.field.type))

const optionsText = computed(() => (props.field.options ?? []).join('\n'))
function setOptions(text: string) {
  patch({ options: text.split('\n').map(o => o.trim()).filter(Boolean) })
}

function numberOrUndefined(v: string): number | undefined {
  return v === '' ? undefined : Number(v)
}

function toggleExt(ext: string, on: boolean) {
  const current = props.field.accept ?? []
  patch({ accept: FORM_FILE_EXTENSIONS.filter(e => (e === ext ? on : current.includes(e))) })
}

const inputClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
</script>

<template>
  <div class="space-y-3 text-sm">
    <div class="space-y-1">
      <label class="text-xs font-medium text-muted-foreground">{{ isSection ? 'Heading' : 'Question' }}</label>
      <input :class="inputClass" :value="field.label" maxlength="300" data-test="field-label" @input="patch({ label: ($event.target as HTMLInputElement).value })">
    </div>

    <div class="space-y-1">
      <label class="text-xs font-medium text-muted-foreground">{{ isSection ? 'Text' : 'Help text' }}</label>
      <textarea :class="[inputClass, 'h-auto']" rows="2" maxlength="2000" :value="field.help ?? ''" @input="patch({ help: ($event.target as HTMLTextAreaElement).value })" />
    </div>

    <div v-if="hasPlaceholder" class="space-y-1">
      <label class="text-xs font-medium text-muted-foreground">Placeholder</label>
      <input :class="inputClass" maxlength="200" :value="field.placeholder ?? ''" @input="patch({ placeholder: ($event.target as HTMLInputElement).value })">
    </div>

    <div v-if="hasOptions" class="space-y-1">
      <label class="text-xs font-medium text-muted-foreground">Options (one per line)</label>
      <textarea :class="[inputClass, 'h-auto font-mono text-xs']" rows="4" :value="optionsText" data-test="field-options" @change="setOptions(($event.target as HTMLTextAreaElement).value)" />
      <p class="text-xs text-muted-foreground">Up to {{ FORM_LIMITS.options }} options, each unique.</p>
    </div>

    <div v-if="field.type === 'number' || field.type === 'currency'" class="grid grid-cols-2 gap-2">
      <div class="space-y-1">
        <label class="text-xs font-medium text-muted-foreground">Minimum</label>
        <input type="number" :class="inputClass" :value="field.min ?? ''" @change="patch({ min: numberOrUndefined(($event.target as HTMLInputElement).value) })">
      </div>
      <div class="space-y-1">
        <label class="text-xs font-medium text-muted-foreground">Maximum</label>
        <input type="number" :class="inputClass" :value="field.max ?? ''" @change="patch({ max: numberOrUndefined(($event.target as HTMLInputElement).value) })">
      </div>
    </div>

    <template v-if="field.type === 'file'">
      <div class="space-y-1">
        <label class="text-xs font-medium text-muted-foreground">Accepted file types</label>
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          <label v-for="ext in FORM_FILE_EXTENSIONS" :key="ext" class="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" class="h-3.5 w-3.5 accent-primary" :checked="field.accept?.includes(ext)" @change="toggleExt(ext, ($event.target as HTMLInputElement).checked)">
            {{ ext }}
          </label>
        </div>
      </div>
      <div class="space-y-1 w-32">
        <label class="text-xs font-medium text-muted-foreground">Max files</label>
        <input type="number" min="1" :max="FORM_LIMITS.maxFiles" :class="inputClass" :value="field.maxFiles ?? 1" @change="patch({ maxFiles: Math.min(FORM_LIMITS.maxFiles, Math.max(1, Number(($event.target as HTMLInputElement).value) || 1)) })">
      </div>
    </template>

    <label v-if="!isSection" class="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" class="h-4 w-4 accent-primary" :checked="!!field.required" data-test="field-required" @change="patch({ required: ($event.target as HTMLInputElement).checked })">
      <span>{{ field.type === 'checkbox' ? 'Must be ticked' : 'Required' }}</span>
    </label>

    <p class="text-[11px] text-muted-foreground">{{ FORM_FIELD_META[field.type].label }} · id <code>{{ field.id }}</code></p>
  </div>
</template>
