<script setup lang="ts">
import ChatPanel from '../ai/ChatPanel.vue'
import NotesPanel from './NotesPanel.vue'

// The company page's right-hand side pane (mficrm-bwv.4), as in xivly's reader: Notes | Chat tabs next to
// whatever tab of the company is open. Both panels stay mounted once opened, so an answer keeps streaming while
// you look at the notes. Resizable by dragging its left edge (wide screens); full width on small ones.
const props = defineProps<{
  business: { id: number, name: string, asking_price: number | null, trailing_12m_revenue: number | null, trailing_12m_profit: number | null, platform: string | null }
}>()

const { open, width, tab, persist } = useCompanyPane()
const mounted = reactive({ notes: false, chat: false })
watchEffect(() => {
  if (open.value) mounted[tab.value] = true
})

function select(which: 'notes' | 'chat') {
  tab.value = which
  persist()
}
function close() {
  open.value = false
  persist()
}

// Dragging the left edge
let startX = 0
let startWidth = 0
function onDrag(e: PointerEvent) {
  width.value = Math.min(Math.max(startWidth + (startX - e.clientX), 320), Math.min(1200, window.innerWidth - 360))
}
function endDrag() {
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
  document.body.style.userSelect = ''
  persist()
}
function startDrag(e: PointerEvent) {
  startX = e.clientX
  startWidth = width.value
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
}
onBeforeUnmount(endDrag)

defineExpose({ businessId: computed(() => props.business.id) })
</script>

<template>
  <aside
    v-show="open"
    class="company-pane fixed inset-0 z-40 lg:relative lg:inset-auto lg:z-auto flex flex-col bg-card lg:border-l min-h-0 shrink-0"
    :style="{ '--pane-width': `${width}px` }"
    data-test="company-pane"
  >
    <div class="hidden lg:block absolute left-0 top-0 bottom-0 w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/30 z-10" title="Drag to resize" @pointerdown.prevent="startDrag" />
    <div class="flex items-center gap-1 border-b px-2 shrink-0">
      <button
        v-for="t in ([{ key: 'notes', label: 'Notes', icon: 'lucide:notebook-pen' }, { key: 'chat', label: 'Chat', icon: 'lucide:messages-square' }] as const)"
        :key="t.key"
        :class="['flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 -mb-px', tab === t.key ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground']"
        :data-test="`pane-tab-${t.key}`"
        @click="select(t.key)"
      >
        <Icon :name="t.icon" class="h-4 w-4" />
        {{ t.label }}
      </button>
      <button class="ml-auto p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close the pane" data-test="pane-close" @click="close">
        <Icon name="lucide:x" class="h-4 w-4" />
      </button>
    </div>
    <div class="flex-1 min-h-0 relative">
      <NotesPanel v-if="mounted.notes" v-show="tab === 'notes'" :business-id="business.id" :active="open && tab === 'notes'" class="absolute inset-0" />
      <ChatPanel v-if="mounted.chat" v-show="tab === 'chat'" :business="business" :active="open && tab === 'chat'" class="absolute inset-0" />
    </div>
  </aside>
</template>

<style scoped>
@media (min-width: 1024px) {
  .company-pane { width: var(--pane-width); }
}
</style>
