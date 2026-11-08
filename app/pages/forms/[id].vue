<script setup lang="ts">
import draggable from 'vuedraggable'
import type { FormAnswers, FormField, FormFieldType, FormSchema } from '~/shared/forms'
import { FORM_FIELD_META, FORM_FIELD_TYPES, newField, publishProblems, submissionErrors } from '~/shared/forms'

// Form builder: edit the draft (fields, order, settings) with a live preview, then publish it as a new version.
// Published versions are immutable; editing after publishing changes only the draft until the next publish.

interface FormDetail {
  id: number
  name: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  draft_schema: FormSchema
  latest_version: number | null
  has_unpublished_changes: boolean
  business_id: number | null
  business_name: string | null
  versions: { version: number, published_at: string, published_by_username: string | null, field_count: number }[]
}

const route = useRoute()
const router = useRouter()
const id = String(route.params.id)
const { formatDateTime } = useFormatting()

const requestFetch = useRequestFetch() // forwards the session cookie during server rendering
const { data: form, refresh, error: loadError } = await useAsyncData(`form-${id}`, () => requestFetch<FormDetail>(`/api/forms/${id}`))

// Local working copy; `dirty` until saved
const name = ref('')
const description = ref('')
const fields = ref<FormField[]>([])
const savedSnapshot = ref('')
function snapshot() {
  return JSON.stringify({ name: name.value, description: description.value, fields: fields.value })
}
function loadFrom(f: FormDetail) {
  name.value = f.name
  description.value = f.description ?? ''
  fields.value = structuredClone(toRaw(f.draft_schema?.fields ?? []))
  savedSnapshot.value = snapshot()
}
watch(form, f => f && loadFrom(f), { immediate: true })
const dirty = computed(() => savedSnapshot.value !== snapshot())

const selectedId = ref<string | null>(null)
const schema = computed<FormSchema>(() => ({ fields: fields.value }))
const problems = computed(() => publishProblems(schema.value))
const readOnly = computed(() => form.value?.status === 'archived')

function addField(type: FormFieldType) {
  const field = newField(type)
  const at = selectedId.value ? fields.value.findIndex(f => f.id === selectedId.value) + 1 : fields.value.length
  fields.value.splice(at || fields.value.length, 0, field)
  selectedId.value = field.id
}
function updateField(updated: FormField) {
  const i = fields.value.findIndex(f => f.id === updated.id)
  if (i >= 0) fields.value[i] = updated
}
function duplicateField(field: FormField) {
  const copy = { ...structuredClone(toRaw(field)), id: newField(field.type).id }
  fields.value.splice(fields.value.indexOf(field) + 1, 0, copy)
  selectedId.value = copy.id
}
function removeField(field: FormField) {
  fields.value = fields.value.filter(f => f.id !== field.id)
  if (selectedId.value === field.id) selectedId.value = null
}
function move(field: FormField, dir: -1 | 1) {
  const i = fields.value.indexOf(field)
  const j = i + dir
  if (j < 0 || j >= fields.value.length) return
  const next = [...fields.value]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  fields.value = next
}

// Saving and publishing
const saving = ref(false)
const publishing = ref(false)
const message = ref<{ kind: 'ok' | 'error', text: string } | null>(null)
function errorText(e: unknown, fallback: string) {
  const data = (e as { data?: { message?: string, data?: { message: string }[] } })?.data
  return data?.data?.length ? data.data.map(d => d.message).join('; ') : data?.message || fallback
}

async function save(quiet = false) {
  saving.value = true
  message.value = null
  try {
    await $fetch(`/api/forms/${id}`, { method: 'PATCH', body: { name: name.value, description: description.value, draft_schema: schema.value } })
    await refresh()
    if (!quiet) message.value = { kind: 'ok', text: 'Draft saved' }
    return true
  } catch (e) {
    message.value = { kind: 'error', text: errorText(e, 'Could not save the draft') }
    return false
  } finally {
    saving.value = false
  }
}

async function publish() {
  if (problems.value.length) return
  const next = (form.value?.latest_version ?? 0) + 1
  if (!confirm(form.value?.latest_version
    ? `Publish version ${next}? New links will use it; links already sent keep the version they were sent with.`
    : 'Publish this form? You can then send links to it.')) return
  publishing.value = true
  try {
    if (dirty.value && !(await save(true))) return
    const r = await $fetch<{ version: number }>(`/api/forms/${id}/publish`, { method: 'POST' })
    await refresh()
    message.value = { kind: 'ok', text: `Published version ${r.version}` }
  } catch (e) {
    message.value = { kind: 'error', text: errorText(e, 'Could not publish') }
  } finally {
    publishing.value = false
  }
}

async function setArchived(archived: boolean) {
  if (archived && !confirm('Archive this form? It will be hidden from the forms list and can\'t be sent until restored.')) return
  await $fetch(`/api/forms/${id}`, { method: 'PATCH', body: { archived } })
  await refresh()
}

async function deleteForm() {
  if (!confirm('Delete this draft form? This cannot be undone.')) return
  await $fetch(`/api/forms/${id}`, { method: 'DELETE' })
  savedSnapshot.value = snapshot() // nothing left to lose
  await router.push('/forms')
}

// Unsaved changes: warn before leaving
onBeforeRouteLeave(() => {
  if (dirty.value && !confirm('You have unsaved changes. Leave anyway?')) return false
})
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))

// Live preview, with a "check answers" run of the same validation the server applies to submissions
const previewAnswers = ref<FormAnswers>({})
const previewFiles = ref<Record<string, File[]>>({})
const previewErrors = ref<Record<string, string>>({})
const previewChecked = ref(false)
const previewRenderer = ref<{ validate: () => Promise<boolean>, reset: () => void } | null>(null)
// FormKit's validation (as the public page shows it), then the same check the server applies
async function checkPreview() {
  previewErrors.value = {}
  const ok = await previewRenderer.value?.validate()
  previewErrors.value = ok ? submissionErrors(schema.value, previewAnswers.value) : { _formkit: 'invalid' }
  previewChecked.value = true
}
function resetPreview() {
  previewRenderer.value?.reset()
  previewAnswers.value = {}
  previewFiles.value = {}
  previewErrors.value = {}
  previewChecked.value = false
}
watch(fields, async () => {
  if (previewChecked.value) {
    await nextTick()
    await checkPreview()
  }
}, { deep: true })

// Viewing an earlier version (read-only)
const viewing = ref<{ version: number, schema: FormSchema, published_at: string } | null>(null)
async function viewVersion(version: number) {
  viewing.value = await $fetch(`/api/forms/${id}/versions/${version}`)
}
const viewingAnswers = ref<FormAnswers>({})

const statusClass: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  archived: 'bg-muted text-muted-foreground',
}
</script>

<template>
  <div v-if="loadError || !form" class="p-6">
    <EmptyState title="Form not found" icon="lucide:search" action-label="Back to forms" @action="router.push('/forms')" />
  </div>

  <div v-else class="flex flex-col h-full">
    <!-- Header -->
    <div class="border-b bg-card px-6 py-4 shrink-0">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <NuxtLink to="/forms" class="text-muted-foreground hover:text-foreground mt-1.5" aria-label="Back to forms">
            <Icon name="lucide:arrow-left" class="h-5 w-5" />
          </NuxtLink>
          <div class="min-w-0 flex-1 space-y-1">
            <input
              v-model="name"
              :disabled="readOnly"
              maxlength="200"
              aria-label="Form name"
              class="w-full bg-transparent text-xl font-bold rounded px-1 -mx-1 hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
            >
            <div class="flex items-center gap-2 flex-wrap text-xs">
              <span :class="['rounded-full px-2 py-0.5 font-medium capitalize', statusClass[form.status]]">{{ form.status }}</span>
              <NuxtLink v-if="form.business_id" :to="`/businesses/${form.business_id}?tab=forms`" class="text-muted-foreground hover:text-foreground hover:underline flex items-center gap-1">
                <Icon name="lucide:building-2" class="h-3.5 w-3.5" />{{ form.business_name }}
              </NuxtLink>
              <span v-if="form.latest_version" class="text-muted-foreground">Live: version {{ form.latest_version }}</span>
              <span v-if="dirty" class="text-amber-700 dark:text-amber-300">Unsaved changes</span>
              <span v-else-if="form.has_unpublished_changes" class="text-amber-700 dark:text-amber-300">Draft differs from version {{ form.latest_version }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <template v-if="!readOnly">
            <Button variant="outline" size="sm" :loading="saving" :disabled="!dirty" @click="save()">
              <Icon name="lucide:save" class="h-4 w-4" />
              <span class="hidden sm:inline">Save draft</span>
            </Button>
            <Button
              size="sm"
              :loading="publishing"
              :disabled="problems.length > 0 || (!dirty && !!form.latest_version && !form.has_unpublished_changes)"
              :title="problems.join('\n')"
              @click="publish"
            >
              <Icon name="lucide:send" class="h-4 w-4" />
              {{ form.latest_version ? `Publish v${form.latest_version + 1}` : 'Publish' }}
            </Button>
            <Button v-if="form.latest_version" variant="ghost" size="sm" aria-label="Archive form" title="Archive" @click="setArchived(true)">
              <Icon name="lucide:archive" class="h-4 w-4" />
            </Button>
            <Button v-else variant="ghost" size="sm" aria-label="Delete form" title="Delete" @click="deleteForm">
              <Icon name="lucide:trash-2" class="h-4 w-4 text-destructive" />
            </Button>
          </template>
          <Button v-else size="sm" variant="outline" @click="setArchived(false)">
            <Icon name="lucide:archive-restore" class="h-4 w-4" />
            Restore
          </Button>
        </div>
      </div>
      <p v-if="message" :class="['text-sm mt-2', message.kind === 'ok' ? 'text-green-700 dark:text-green-300' : 'text-destructive']" role="status">
        {{ message.text }}
      </p>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="grid lg:grid-cols-12 gap-6 p-6">
        <!-- Builder -->
        <div class="lg:col-span-7 space-y-4">
          <Card class="p-4 space-y-2">
            <label class="text-xs font-medium text-muted-foreground" for="form-description">Description (shown at the top of the form)</label>
            <textarea
              id="form-description"
              v-model="description"
              :disabled="readOnly"
              rows="2"
              maxlength="2000"
              class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Card>

          <Card v-if="!readOnly" class="p-4">
            <p class="text-xs font-medium text-muted-foreground mb-2">Add a field{{ selectedId ? ' (after the selected one)' : '' }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="type in FORM_FIELD_TYPES"
                :key="type"
                type="button"
                :data-add="type"
                class="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                @click="addField(type)"
              >
                <Icon :name="FORM_FIELD_META[type].icon" class="h-3.5 w-3.5 text-muted-foreground" />
                {{ FORM_FIELD_META[type].label }}
              </button>
            </div>
          </Card>

          <div v-if="!fields.length" class="rounded-lg border-2 border-dashed p-10 text-center text-sm text-muted-foreground">
            No fields yet. Add one above.
          </div>

          <draggable
            v-model="fields"
            item-key="id"
            handle=".drag-handle"
            :disabled="readOnly"
            class="space-y-2"
            ghost-class="opacity-40"
          >
            <template #item="{ element: field, index }">
              <Card
                :class="['transition-shadow', selectedId === field.id ? 'ring-2 ring-primary' : 'hover:shadow-sm']"
                :data-field="field.id"
              >
                <div class="flex items-center gap-2 px-3 py-2 cursor-pointer" @click="selectedId = selectedId === field.id ? null : field.id">
                  <button v-if="!readOnly" type="button" class="drag-handle cursor-grab text-muted-foreground hover:text-foreground p-1" aria-label="Drag to reorder" @click.stop>
                    <Icon name="lucide:grip-vertical" class="h-4 w-4" />
                  </button>
                  <Icon :name="FORM_FIELD_META[field.type as FormFieldType].icon" class="h-4 w-4 text-muted-foreground shrink-0" />
                  <div class="min-w-0 flex-1">
                    <div :class="['text-sm truncate', field.type === 'section' ? 'font-semibold' : 'font-medium']">
                      {{ field.label || 'Untitled' }}<span v-if="field.required" class="text-destructive ml-0.5">*</span>
                    </div>
                    <div class="text-xs text-muted-foreground">{{ FORM_FIELD_META[field.type as FormFieldType].label }}</div>
                  </div>
                  <div v-if="!readOnly" class="flex items-center shrink-0" @click.stop>
                    <button type="button" class="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" :disabled="index === 0" aria-label="Move up" @click="move(field, -1)">
                      <Icon name="lucide:chevron-up" class="h-4 w-4" />
                    </button>
                    <button type="button" class="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" :disabled="index === fields.length - 1" aria-label="Move down" @click="move(field, 1)">
                      <Icon name="lucide:chevron-down" class="h-4 w-4" />
                    </button>
                    <button type="button" class="p-1 text-muted-foreground hover:text-foreground" aria-label="Duplicate" @click="duplicateField(field)">
                      <Icon name="lucide:copy" class="h-4 w-4" />
                    </button>
                    <button type="button" class="p-1 text-muted-foreground hover:text-destructive" aria-label="Delete field" @click="removeField(field)">
                      <Icon name="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div v-if="selectedId === field.id && !readOnly" class="border-t px-4 py-3">
                  <FormFieldEditor :field="field" @update="updateField" />
                </div>
              </Card>
            </template>
          </draggable>

          <div v-if="problems.length && fields.length && !readOnly" class="rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
            <p class="font-medium mb-1">Fix before publishing:</p>
            <ul class="list-disc pl-4 space-y-0.5">
              <li v-for="p in problems" :key="p">{{ p }}</li>
            </ul>
          </div>

          <!-- Links sent for this form -->
          <Card v-if="form.latest_version" class="p-4">
            <FormLinksPanel :form-id="form.id" :can-send="form.status !== 'archived'" />
          </Card>

          <!-- Versions -->
          <Card v-if="form.versions.length" class="p-4">
            <h2 class="text-sm font-semibold mb-2">Published versions</h2>
            <div class="divide-y">
              <div v-for="v in form.versions" :key="v.version" class="flex items-center justify-between py-2 text-sm">
                <div>
                  <span class="font-medium">Version {{ v.version }}</span>
                  <span v-if="v.version === form.latest_version" class="ml-2 text-xs text-green-700 dark:text-green-300">live</span>
                  <div class="text-xs text-muted-foreground">
                    {{ formatDateTime(v.published_at) }}<template v-if="v.published_by_username"> by {{ v.published_by_username }}</template> · {{ v.field_count }} fields
                  </div>
                </div>
                <Button variant="ghost" size="sm" @click="viewVersion(v.version)">View</Button>
              </div>
            </div>
          </Card>
        </div>

        <!-- Live preview -->
        <div class="lg:col-span-5">
          <div class="lg:sticky lg:top-0 space-y-2">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Preview</h2>
              <div class="flex gap-1">
                <Button variant="ghost" size="sm" @click="resetPreview">Clear</Button>
                <Button variant="outline" size="sm" data-test="check-preview" @click="checkPreview">Check answers</Button>
              </div>
            </div>
            <Card class="p-6 space-y-4" data-test="preview">
              <div>
                <h3 class="text-lg font-semibold">{{ name || 'Untitled form' }}</h3>
                <p v-if="description" class="text-sm text-muted-foreground mt-1 whitespace-pre-line">{{ description }}</p>
              </div>
              <FormRenderer ref="previewRenderer" v-model="previewAnswers" v-model:files="previewFiles" :schema="schema" :errors="previewErrors" />
              <p v-if="previewChecked && !Object.keys(previewErrors).length" class="text-sm text-green-700 dark:text-green-300">
                These answers would be accepted.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>

    <Modal :open="!!viewing" :title="viewing ? `Version ${viewing.version}` : ''" size="lg" @close="viewing = null">
      <div v-if="viewing" class="p-6 max-h-[70vh] overflow-y-auto space-y-3">
        <p class="text-xs text-muted-foreground">Published {{ formatDateTime(viewing.published_at) }}. Read-only.</p>
        <FormRenderer v-model="viewingAnswers" :schema="viewing.schema" disabled />
      </div>
    </Modal>
  </div>
</template>
