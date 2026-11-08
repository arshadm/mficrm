<script setup lang="ts">
import NotesEditor from './NotesEditor.vue'

// The company's shared notes (mficrm-bwv.1), after xivly's notes pane: saved 800 ms after the last change, one
// write at a time (the latest text wins), retried after 5 s on failure, and flushed when the pane hides, the page
// closes or on ⌘/Ctrl+S. Teammates' saves are picked up every 15 s and applied in place unless there are local
// unsaved edits; a save that crosses someone else's gets a choice instead of overwriting it.
const props = defineProps<{ businessId: number, active: boolean }>()

interface Notes { content: string, version: number, updated_at: string | null, updated_by_username: string | null }

const { notesInserter } = useCompanyPane()
const { formatDateTime } = useFormatting()

const editorRef = ref<InstanceType<typeof NotesEditor> | null>(null)
const loading = ref(true)
const loadError = ref('')
const content = ref('')
const saved = ref<Notes | null>(null)
const status = ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
const saveError = ref('')
const conflict = ref<Notes | null>(null)
const uploadError = ref('')

let timer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null
let dirty = false

async function load() {
  try {
    const notes = await $fetch<Notes>(`/api/businesses/${props.businessId}/notes`)
    saved.value = notes
    content.value = notes.content
    editorRef.value?.setContent(notes.content)
    loadError.value = ''
  } catch (e) {
    loadError.value = errorMessage(e, 'The notes could not be loaded')
  } finally {
    loading.value = false
  }
}

function schedule(delay = 800) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void save() }, delay)
}

watch(content, (val) => {
  if (loading.value || val === saved.value?.content) return
  dirty = true
  status.value = 'pending'
  schedule()
})

async function save(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (inFlight) {
    await inFlight
    if (dirty) return save()
    return
  }
  if (!dirty || conflict.value || !saved.value) return
  const text = content.value
  dirty = false
  status.value = 'saving'
  inFlight = (async () => {
    try {
      const result = await $fetch<Notes>(`/api/businesses/${props.businessId}/notes`, {
        method: 'PUT',
        body: { content: text, base_version: saved.value!.version },
      })
      saved.value = result
      status.value = dirty ? 'pending' : 'saved'
      saveError.value = ''
    } catch (e) {
      const err = e as { statusCode?: number, data?: { data?: Notes } }
      if (err.statusCode === 409 && err.data?.data) {
        dirty = true
        conflict.value = err.data.data
        status.value = 'error'
        saveError.value = 'Someone else changed the notes'
      } else {
        dirty = true
        status.value = 'error'
        saveError.value = errorMessage(e, 'The notes could not be saved')
        schedule(5000)
      }
    } finally {
      inFlight = null
    }
  })()
  await inFlight
  if (dirty && !conflict.value && (status.value as string) !== 'error') schedule()
}

function useTheirs() {
  const theirs = conflict.value!
  conflict.value = null
  dirty = false
  saved.value = theirs
  content.value = theirs.content
  editorRef.value?.setContent(theirs.content)
  status.value = 'saved'
  saveError.value = ''
}

function keepMine() {
  saved.value = conflict.value
  conflict.value = null
  dirty = true
  void save()
}

// Pick up teammates' saves
async function poll() {
  if (!props.active || dirty || inFlight || conflict.value || document.hidden) return
  try {
    const notes = await $fetch<Notes>(`/api/businesses/${props.businessId}/notes`)
    if (!saved.value || notes.version === saved.value.version || dirty || inFlight) return
    saved.value = notes
    content.value = notes.content
    editorRef.value?.setContent(notes.content)
  } catch {}
}

function onKey(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && props.active) {
    e.preventDefault()
    void save()
  }
}
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty || inFlight) {
    void save()
    e.preventDefault()
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void load()
  pollTimer = setInterval(poll, 15000)
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
  // "Add to notes" from the chat
  notesInserter.value = (html: string) => editorRef.value?.insertAtEnd(html)
})
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
  notesInserter.value = null
  if (dirty) void save()
})
watch(() => props.active, (a) => {
  if (!a && dirty) void save()
  if (a) void poll()
})

const statusText = computed(() => {
  if (status.value === 'pending' || status.value === 'saving') return 'Saving…'
  if (status.value === 'error') return 'Not saved'
  if (saved.value?.updated_at) {
    return `Saved ${formatDateTime(saved.value.updated_at)}${saved.value.updated_by_username ? ` by ${saved.value.updated_by_username}` : ''}`
  }
  return ''
})
</script>

<template>
  <div class="flex flex-col h-full min-h-0" data-test="company-notes">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
    <div v-else-if="loadError" class="m-4 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300">
      {{ loadError }} <button class="underline ml-1" @click="loading = true; load()">Try again</button>
    </div>
    <template v-else>
      <div
        v-if="conflict"
        class="border-b border-amber-300 bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 flex flex-wrap items-center gap-2 shrink-0"
        data-test="notes-conflict"
      >
        <Icon name="lucide:users" class="h-4 w-4" />
        <span class="flex-1 min-w-[12rem]">{{ conflict.updated_by_username || 'Someone' }} changed the notes while you were editing.</span>
        <button class="underline font-medium" data-test="notes-use-theirs" @click="useTheirs">Use their version</button>
        <button class="underline font-medium" data-test="notes-keep-mine" @click="keepMine">Keep mine</button>
      </div>
      <div v-if="uploadError" class="border-b border-red-300 bg-red-100 px-3 py-1.5 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300 flex items-center gap-2 shrink-0">
        <span class="flex-1">{{ uploadError }}</span>
        <button aria-label="Dismiss" @click="uploadError = ''"><Icon name="lucide:x" class="h-3.5 w-3.5" /></button>
      </div>
      <NotesEditor
        ref="editorRef"
        v-model="content"
        :business-id="businessId"
        class="flex-1 min-h-0"
        @upload-error="uploadError = $event"
      />
      <div class="border-t px-3 py-1 text-[11px] text-muted-foreground flex items-center gap-1.5 shrink-0" data-test="notes-status">
        <span :class="status === 'error' ? 'text-destructive font-medium' : ''" :title="saveError">{{ statusText }}</span>
        <span class="ml-auto hidden sm:inline">Shared with the team</span>
      </div>
    </template>
  </div>
</template>
