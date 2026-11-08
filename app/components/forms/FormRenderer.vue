<script setup lang="ts">
import { createMessage, type FormKitNode } from '@formkit/core'
import { markRaw } from 'vue'
import type { FormAnswers, FormSchema } from '~/shared/forms'
import { toFormKitSchema, type FormKitFileItem } from '~/utils/formkitSchema'
import FormSectionHeading from './FormSectionHeading.vue'

// Renders a CRM form schema with FormKit (mficrm-b6g.1). Used for the builder's live preview, read-only views of
// published versions, and the public form pages (/f/*).
//
// - v-model: answers keyed by field id, in the shape the server validates (file fields hold the chosen names)
// - v-model:files: the chosen File objects per file field, uploaded by the page that submits
// - errors: errors from elsewhere (the shared Zod check, or the server), shown on the matching fields
// - validate(): shows FormKit's own validation messages and resolves to whether the answers pass them
interface Props {
  schema: FormSchema
  modelValue: FormAnswers
  files?: Record<string, File[]>
  errors?: Record<string, string>
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), { files: () => ({}), errors: () => ({}) })
const emit = defineEmits<{ 'update:modelValue': [FormAnswers], 'update:files': [Record<string, File[]>] }>()

const fkSchema = computed(() => toFormKitSchema(props.schema))
const library = markRaw({ FormSectionHeading })
const values = ref<Record<string, unknown>>({ ...props.modelValue })
const group = shallowRef<FormKitNode | null>(null)

// FormKit values → answers + files
watch(values, (v) => {
  const answers: FormAnswers = {}
  const files: Record<string, File[]> = {}
  for (const field of props.schema.fields) {
    if (field.type === 'section' || !(field.id in v)) continue
    const value = v[field.id]
    if (field.type === 'file') {
      const items = Array.isArray(value) ? value as FormKitFileItem[] : []
      answers[field.id] = items.map(f => f.name)
      files[field.id] = items.map(f => f.file).filter((f): f is File => !!f)
    } else {
      answers[field.id] = value as FormAnswers[string]
    }
  }
  emit('update:modelValue', answers)
  emit('update:files', files)
}, { deep: true })

// The parent clearing the answers resets the inputs
watch(() => props.modelValue, (v) => {
  if (!Object.keys(v).length && group.value && Object.keys(values.value).some(k => values.value[k] !== undefined)) reset()
})

function showErrors(errors: Record<string, string>) {
  if (!group.value) return
  group.value.clearErrors(true)
  const forFields = Object.fromEntries(Object.entries(errors).filter(([id]) => group.value!.at(id)))
  if (Object.keys(forFields).length) group.value.setErrors([], forFields)
}
watch(() => props.errors, showErrors, { deep: true })

async function validate(): Promise<boolean> {
  const node = group.value
  if (!node) return true
  // What a FormKit form does on submit: mark every input submitted, so 'submit'-visibility messages show
  node.walk(n => n.store.set(createMessage({ key: 'submitted', value: true, visible: false })))
  await node.settled
  // Re-validation after a change runs in a timeout and holds a blocking 'validating' message meanwhile: wait
  // for every input to finish (bounded) before counting what still blocks
  for (let i = 0; i < 100; i++) {
    let busy = false
    node.walk((n) => { if (n.store.validating) busy = true })
    if (!busy) break
    await new Promise(r => setTimeout(r, 10))
  }
  return node.ledger.value('blocking') === 0
}

function reset() {
  group.value?.reset()
  values.value = {}
}

defineExpose({ validate, reset })
</script>

<template>
  <FormKit
    v-model="values"
    type="group"
    :disabled="disabled"
    @node="(n: FormKitNode) => { group = n; showErrors(errors) }"
  >
    <div class="space-y-5">
      <FormKitSchema :schema="fkSchema" :library="library" />
      <p v-if="!schema.fields.length" class="text-sm text-muted-foreground italic">No fields yet.</p>
    </div>
  </FormKit>
</template>
