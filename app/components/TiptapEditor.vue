<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  modelValue?: string | null
  placeholder?: string
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), { placeholder: 'Start typing...' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editor = useEditor({
  content: props.modelValue || '',
  editable: !props.readonly,
  extensions: [
    StarterKit,
    Placeholder.configure({ placeholder: props.placeholder }),
  ],
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && val !== editor.value.getHTML()) {
    editor.value.commands.setContent(val || '', false)
  }
})

watch(() => props.readonly, (val) => {
  editor.value?.setEditable(!val)
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div :class="['tiptap-editor border rounded-md overflow-hidden', readonly ? 'bg-muted/30' : 'bg-background']">
    <div v-if="!readonly && editor" class="flex flex-wrap gap-0.5 border-b bg-muted/30 p-1">
      <button
        v-for="action in [
          { icon: 'lucide:bold', cmd: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
          { icon: 'lucide:italic', cmd: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
          { icon: 'lucide:list', cmd: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
          { icon: 'lucide:list-ordered', cmd: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
          { icon: 'lucide:quote', cmd: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
        ]"
        :key="action.icon"
        type="button"
        :class="['p-1.5 rounded hover:bg-muted transition-colors', action.active ? 'bg-muted text-foreground' : 'text-muted-foreground']"
        @click="action.cmd()"
      >
        <Icon :name="action.icon" class="h-4 w-4" />
      </button>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>
