<script setup lang="ts">
// A company's documents (mficrm-b6g.2): Flippa listing exports (PDF) and P&L accounts (CSV/Excel)
const props = defineProps<{ businessId: number }>()
const emit = defineEmits<{ changed: [], count: [number] }>()

interface Doc { id: number, filename: string, original_name: string, mime_type: string | null, file_size: number | null, uploaded_at: string }

const { formatDate } = useFormatting()
const docs = ref<Doc[]>([])
const loading = ref(true)
const uploading = ref(false)
const error = ref('')
const input = ref<HTMLInputElement | null>(null)

async function load() {
  loading.value = true
  try {
    docs.value = await $fetch<Doc[]>(`/api/businesses/${props.businessId}/documents`)
    emit('count', docs.value.length)
  } finally {
    loading.value = false
  }
}
onMounted(load)
defineExpose({ docs, load })

async function upload(files: FileList | File[] | null) {
  if (!files?.length) return
  error.value = ''
  uploading.value = true
  try {
    const body = new FormData()
    for (const f of Array.from(files)) body.append('files', f, f.name)
    await $fetch(`/api/businesses/${props.businessId}/documents`, { method: 'POST', body })
    await load()
    emit('changed')
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message || 'Upload failed'
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}

async function remove(doc: Doc) {
  if (!confirm(`Delete ${doc.original_name}?`)) return
  await $fetch(`/api/businesses/${props.businessId}/attachments/${doc.id}`, { method: 'DELETE' })
  await load()
  emit('changed')
}

function icon(name: string) {
  return /\.pdf$/i.test(name) ? 'lucide:file-text' : 'lucide:file-spreadsheet'
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold">Documents</h2>
      <Button size="sm" variant="outline" :loading="uploading" @click="input?.click()">
        <Icon name="lucide:upload" class="h-4 w-4" />
        Add documents
      </Button>
      <input ref="input" type="file" multiple accept=".pdf,.csv,.xlsx,.xls" class="hidden" data-test="doc-input" @change="upload(($event.target as HTMLInputElement).files)">
    </div>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <div v-if="loading" class="flex justify-center py-6">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
    <div
      v-else-if="!docs.length"
      class="rounded-md border-2 border-dashed p-6 text-center text-sm text-muted-foreground"
      @dragover.prevent
      @drop.prevent="upload($event.dataTransfer?.files ?? null)"
    >
      No documents yet. Add the listing export (PDF) and P&L accounts (CSV or Excel), or drop them here.
    </div>
    <div v-else class="divide-y rounded-md border" data-test="documents" @dragover.prevent @drop.prevent="upload($event.dataTransfer?.files ?? null)">
      <div v-for="doc in docs" :key="doc.id" class="flex items-center gap-3 px-3 py-2 text-sm">
        <Icon :name="icon(doc.original_name)" class="h-4 w-4 text-muted-foreground shrink-0" />
        <a :href="`/uploads/${doc.filename}`" target="_blank" rel="noopener" class="min-w-0 flex-1 truncate hover:underline">{{ doc.original_name }}</a>
        <span class="text-xs text-muted-foreground shrink-0">{{ doc.file_size ? Math.max(1, Math.round(doc.file_size / 1024)) + ' KB · ' : '' }}{{ formatDate(doc.uploaded_at) }}</span>
        <button class="text-muted-foreground hover:text-destructive" :aria-label="`Delete ${doc.original_name}`" @click="remove(doc)">
          <Icon name="lucide:trash-2" class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
