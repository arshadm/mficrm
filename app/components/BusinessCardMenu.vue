<script setup lang="ts">
import type { NextStep } from '~/shared/types'

interface Props {
  businessId: number
  businessName: string
  activeStep: NextStep | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ updated: [] }>()

const open = ref(false)
const showSetStep = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const form = reactive({ title: '', due_date: '', notes: '' })
const saving = ref(false)
const error = ref('')

async function handleCreate() {
  error.value = ''
  if (!form.title.trim() || !form.due_date) { error.value = 'Title and due date required'; return }
  saving.value = true
  try {
    await $fetch(`/api/businesses/${props.businessId}/next-steps`, {
      method: 'POST',
      body: { title: form.title, due_date: form.due_date, notes: form.notes || null },
    })
    Object.assign(form, { title: '', due_date: '', notes: '' })
    showSetStep.value = false
    open.value = false
    emit('updated')
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message || 'Failed'
  } finally {
    saving.value = false
  }
}

// Close on outside click
onMounted(() => {
  document.addEventListener('click', (e) => {
    if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
      open.value = false
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('click', () => {})
})
</script>

<template>
  <div ref="menuRef" class="relative" @click.stop>
    <button
      class="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      @click="open = !open"
    >
      <Icon name="lucide:more-horizontal" class="h-4 w-4" />
    </button>

    <div v-if="open" class="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-md shadow-lg z-50 overflow-hidden">
      <NuxtLink
        :to="`/businesses/${businessId}?tab=next-steps`"
        class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
        @click="open = false"
      >
        <Icon name="lucide:target" class="h-4 w-4" />
        View Next Steps
      </NuxtLink>

      <button
        v-if="!activeStep"
        class="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
        @click="showSetStep = true; open = false"
      >
        <Icon name="lucide:plus-circle" class="h-4 w-4" />
        Set Next Step
      </button>

      <div v-if="activeStep" class="px-3 py-2 text-xs text-muted-foreground border-t">
        <p class="font-medium text-foreground truncate">{{ activeStep.title }}</p>
        <p>Due: {{ activeStep.due_date }}</p>
      </div>

      <NuxtLink
        :to="`/businesses/${businessId}`"
        class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors border-t"
        @click="open = false"
      >
        <Icon name="lucide:external-link" class="h-4 w-4" />
        Open Business
      </NuxtLink>
    </div>

    <!-- Quick set-step form modal -->
    <Modal :open="showSetStep" title="Set Next Step" @close="showSetStep = false">
      <div class="p-6 space-y-3">
        <p class="text-sm text-muted-foreground">For: <strong>{{ businessName }}</strong></p>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <FormField label="Title" required>
          <Input v-model="form.title" placeholder="What needs to happen?" />
        </FormField>
        <FormField label="Due Date" required>
          <Input v-model="form.due_date" type="date" />
        </FormField>
        <FormField label="Notes">
          <Textarea v-model="form.notes" :rows="2" placeholder="Context..." />
        </FormField>
        <div class="flex gap-2">
          <Button :loading="saving" @click="handleCreate">Save</Button>
          <Button variant="outline" @click="showSetStep = false">Cancel</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
