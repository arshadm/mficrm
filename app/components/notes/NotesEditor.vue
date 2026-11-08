<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'

// Rich-text editor for company notes (mficrm-bwv.1), after xivly's notes editor: a toolbar with shortcuts,
// checklists, tables (with a contextual table bar), links and images. Images are uploaded to the company and
// referenced by URL. `setContent` replaces the text without an update event (remote changes).
const props = defineProps<{ modelValue: string, businessId: number, placeholder?: string, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string], 'uploadError': [string] }>()

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const uploading = ref(0)

async function uploadImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return emit('uploadError', `${file.name}: only PNG, JPEG, GIF or WebP images`)
  if (file.size > 20 * 1024 * 1024) return emit('uploadError', `${file.name} is larger than 20 MB`)
  uploading.value++
  try {
    const body = new FormData()
    body.append('file', file, file.name)
    const res = await $fetch<{ url: string, name: string }>(`/api/businesses/${props.businessId}/notes/images`, { method: 'POST', body })
    editor.value?.chain().focus().setImage({ src: res.url, alt: res.name }).run()
  } catch (e) {
    emit('uploadError', errorMessage(e, 'The image could not be uploaded'))
  } finally {
    uploading.value--
  }
}

function imagesFrom(list: DataTransferItemList | FileList | null | undefined): File[] {
  if (!list) return []
  const files = list instanceof FileList ? Array.from(list) : Array.from(list).map(i => i.getAsFile()).filter((f): f is File => !!f)
  return files.filter(f => f.type.startsWith('image/'))
}

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({ link: { openOnClick: false, autolink: true, defaultProtocol: 'https' } }),
    Placeholder.configure({ placeholder: props.placeholder || 'Write notes about this company…' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Image,
  ],
  editorProps: {
    attributes: { class: 'notes-content focus:outline-none min-h-[12rem] px-4 py-3', 'data-test': 'notes-editor' },
    handlePaste(_view, event) {
      const files = imagesFrom(event.clipboardData?.items)
      if (!files.length) return false
      files.forEach(uploadImage)
      return true
    },
    handleDrop(_view, event) {
      const files = imagesFrom((event as DragEvent).dataTransfer?.files)
      if (!files.length) return false
      event.preventDefault()
      files.forEach(uploadImage)
      return true
    },
    // ⌘/Ctrl-click opens a link
    handleClick(_view, _pos, event) {
      const link = (event.target as HTMLElement).closest('a')
      if (link && (event.metaKey || event.ctrlKey)) {
        window.open(link.href, '_blank', 'noopener')
        return true
      }
      return false
    },
  },
  onUpdate({ editor }) {
    emit('update:modelValue', editor.isEmpty ? '' : editor.getHTML())
  },
})

watch(() => props.disabled, d => editor.value?.setEditable(!d))
onBeforeUnmount(() => editor.value?.destroy())

function setContent(html: string) {
  editor.value?.commands.setContent(html || '', { emitUpdate: false })
}
function insertAtEnd(html: string) {
  const e = editor.value
  if (!e) return
  e.chain().focus('end').insertContent(html).run()
}
defineExpose({ setContent, insertAtEnd })

function setLink() {
  const e = editor.value
  if (!e) return
  const current = e.getAttributes('link').href as string | undefined
  const url = window.prompt('Link address (leave empty to remove the link)', current || 'https://')
  if (url === null) return
  if (!url.trim() || url.trim() === 'https://') e.chain().focus().extendMarkRange('link').unsetLink().run()
  else e.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

const fileInput = ref<HTMLInputElement | null>(null)
const mac = ref(true)
onMounted(() => { mac.value = /Mac|iPhone|iPad/.test(navigator.platform) })
const mod = computed(() => (mac.value ? '⌘' : 'Ctrl+'))
const alt = computed(() => (mac.value ? '⌥' : 'Alt+'))

interface Tool { icon: string, title: string, run: () => void, active?: () => boolean, test?: string }
const groups = computed<Tool[][]>(() => {
  const e = editor.value
  if (!e) return []
  const c = () => e.chain().focus()
  return [
    [
      { icon: 'lucide:bold', title: `Bold (${mod.value}B)`, run: () => c().toggleBold().run(), active: () => e.isActive('bold') },
      { icon: 'lucide:italic', title: `Italic (${mod.value}I)`, run: () => c().toggleItalic().run(), active: () => e.isActive('italic') },
      { icon: 'lucide:underline', title: `Underline (${mod.value}U)`, run: () => c().toggleUnderline().run(), active: () => e.isActive('underline') },
      { icon: 'lucide:strikethrough', title: `Strikethrough (${mod.value}⇧S)`, run: () => c().toggleStrike().run(), active: () => e.isActive('strike') },
      { icon: 'lucide:code', title: `Inline code (${mod.value}E)`, run: () => c().toggleCode().run(), active: () => e.isActive('code') },
      { icon: 'lucide:link', title: 'Link', run: setLink, active: () => e.isActive('link') },
    ],
    [
      { icon: 'lucide:heading-1', title: `Heading 1 (${alt.value}${mod.value}1)`, run: () => c().toggleHeading({ level: 1 }).run(), active: () => e.isActive('heading', { level: 1 }) },
      { icon: 'lucide:heading-2', title: `Heading 2 (${alt.value}${mod.value}2)`, run: () => c().toggleHeading({ level: 2 }).run(), active: () => e.isActive('heading', { level: 2 }) },
      { icon: 'lucide:heading-3', title: `Heading 3 (${alt.value}${mod.value}3)`, run: () => c().toggleHeading({ level: 3 }).run(), active: () => e.isActive('heading', { level: 3 }) },
    ],
    [
      { icon: 'lucide:list', title: `Bullet list (${mod.value}⇧8)`, run: () => c().toggleBulletList().run(), active: () => e.isActive('bulletList') },
      { icon: 'lucide:list-ordered', title: `Numbered list (${mod.value}⇧7)`, run: () => c().toggleOrderedList().run(), active: () => e.isActive('orderedList') },
      { icon: 'lucide:list-checks', title: `Checklist (${mod.value}⇧9)`, run: () => c().toggleTaskList().run(), active: () => e.isActive('taskList'), test: 'notes-checklist' },
      { icon: 'lucide:quote', title: `Quote (${mod.value}⇧B)`, run: () => c().toggleBlockquote().run(), active: () => e.isActive('blockquote') },
      { icon: 'lucide:square-code', title: `Code block (${alt.value}${mod.value}C)`, run: () => c().toggleCodeBlock().run(), active: () => e.isActive('codeBlock') },
      { icon: 'lucide:table', title: 'Table', run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), test: 'notes-table' },
      { icon: 'lucide:image', title: 'Image', run: () => fileInput.value?.click() },
      { icon: 'lucide:minus', title: 'Divider', run: () => c().setHorizontalRule().run() },
    ],
    [
      { icon: 'lucide:undo-2', title: `Undo (${mod.value}Z)`, run: () => c().undo().run() },
      { icon: 'lucide:redo-2', title: `Redo (${mod.value}⇧Z)`, run: () => c().redo().run() },
    ],
  ]
})

const tableTools = computed<Tool[]>(() => {
  const e = editor.value
  if (!e) return []
  const c = () => e.chain().focus()
  return [
    { icon: 'lucide:between-horizontal-end', title: 'Add row below', run: () => c().addRowAfter().run() },
    { icon: 'lucide:between-vertical-end', title: 'Add column to the right', run: () => c().addColumnAfter().run() },
    { icon: 'lucide:rows-3', title: 'Delete row', run: () => c().deleteRow().run() },
    { icon: 'lucide:columns-3', title: 'Delete column', run: () => c().deleteColumn().run() },
    { icon: 'lucide:panel-top', title: 'Header row on/off', run: () => c().toggleHeaderRow().run() },
    { icon: 'lucide:trash-2', title: 'Delete table', run: () => c().deleteTable().run() },
  ]
})
// Re-render toolbar state as the selection moves
const tick = ref(0)
watch(editor, (e) => { e?.on('transaction', () => tick.value++) }, { immediate: true })
const inTable = computed(() => (tick.value, editor.value?.isActive('table') ?? false))
const isActive = (t: Tool) => (tick.value, t.active?.() ?? false)
</script>

<template>
  <div class="flex flex-col min-h-0 h-full">
    <div v-if="editor && !disabled" class="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1 shrink-0">
      <template v-for="(group, gi) in groups" :key="gi">
        <span v-if="gi" class="mx-1 h-5 w-px bg-border" />
        <button
          v-for="t in group"
          :key="t.icon"
          type="button"
          :title="t.title"
          :aria-label="t.title"
          :data-test="t.test"
          :class="['p-1.5 rounded transition-colors hover:bg-muted', isActive(t) ? 'bg-muted text-foreground' : 'text-muted-foreground']"
          @mousedown.prevent
          @click="t.run()"
        >
          <Icon :name="t.icon" class="h-4 w-4" />
        </button>
      </template>
      <Icon v-if="uploading" name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground ml-1" />
      <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="hidden" @change="imagesFrom(($event.target as HTMLInputElement).files).forEach(uploadImage); ($event.target as HTMLInputElement).value = ''">
    </div>
    <div v-if="editor && inTable && !disabled" class="flex items-center gap-0.5 border-b bg-muted/20 px-1.5 py-1 text-xs shrink-0" data-test="table-bar">
      <span class="text-muted-foreground px-1">Table</span>
      <button
        v-for="t in tableTools"
        :key="t.icon"
        type="button"
        :title="t.title"
        :aria-label="t.title"
        class="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        @mousedown.prevent
        @click="t.run()"
      >
        <Icon :name="t.icon" class="h-4 w-4" />
      </button>
    </div>
    <EditorContent :editor="editor" class="flex-1 overflow-y-auto" />
  </div>
</template>
