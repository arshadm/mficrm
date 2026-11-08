<script setup lang="ts">
// Forms made for one company (mficrm-b6g.7): drafted by Claude from its documents, or started blank, then
// edited in the form builder.
const props = defineProps<{ businessId: number, businessName: string }>()

interface FormListRow { id: number, name: string, status: string, latest_version: number | null, field_count: number, updated_at: string }

const router = useRouter()
const { configured, loadStatus } = useAi()
const { formatRelative } = useFormatting()
const forms = ref<FormListRow[]>([])
const loading = ref(true)
const showDraft = ref(false)
const instructions = ref('')
const drafting = ref(false)
const creating = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  try {
    forms.value = await $fetch<FormListRow[]>('/api/forms', { query: { business_id: props.businessId } })
  } finally {
    loading.value = false
  }
}
onMounted(() => { load(); loadStatus() })

async function draft() {
  error.value = ''
  drafting.value = true
  try {
    const res = await $fetch<{ id: number }>(`/api/businesses/${props.businessId}/ai/form`, {
      method: 'POST',
      body: { instructions: instructions.value || null },
    })
    await router.push(`/forms/${res.id}`)
  } catch (e) {
    error.value = errorMessage(e, 'Claude could not draft the form')
  } finally {
    drafting.value = false
  }
}

async function createBlank() {
  creating.value = true
  try {
    const form = await $fetch<{ id: number }>('/api/forms', { method: 'POST', body: { name: `Questions for ${props.businessName}`, business_id: props.businessId } })
    await router.push(`/forms/${form.id}`)
  } finally {
    creating.value = false
  }
}

const statusClass: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
}
</script>

<template>
  <div class="space-y-3" data-test="company-forms">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h2 class="text-sm font-semibold">Forms for this company</h2>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" :loading="creating" @click="createBlank">
          <Icon name="lucide:plus" class="h-4 w-4" />
          Blank form
        </Button>
        <Button v-if="configured" size="sm" data-test="ai-draft-form" @click="showDraft = true; error = ''">
          <Icon name="lucide:sparkles" class="h-4 w-4" />
          Draft with AI
        </Button>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-4">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
    <p v-else-if="!forms.length" class="text-sm text-muted-foreground">
      No forms made for this company yet.{{ configured ? ' Claude can draft one from its documents, asking the seller for what they leave out.' : '' }}
    </p>
    <div v-else class="divide-y rounded-md border">
      <NuxtLink v-for="f in forms" :key="f.id" :to="`/forms/${f.id}`" class="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/50">
        <Icon name="lucide:clipboard-list" class="h-4 w-4 text-muted-foreground shrink-0" />
        <span class="font-medium truncate flex-1">{{ f.name }}</span>
        <span :class="['text-xs rounded-full px-2 py-0.5 font-medium capitalize', statusClass[f.status] || 'bg-muted text-muted-foreground']">{{ f.status }}</span>
        <span class="text-xs text-muted-foreground hidden sm:inline">{{ f.field_count }} fields · {{ formatRelative(f.updated_at) }}</span>
        <Icon name="lucide:chevron-right" class="h-4 w-4 text-muted-foreground" />
      </NuxtLink>
    </div>

    <Modal :open="showDraft" title="Draft a form with AI" size="md" @close="drafting || (showDraft = false)">
      <form class="p-6 space-y-4" @submit.prevent="draft">
        <p class="text-sm text-muted-foreground">
          Claude reads this company's documents and drafts a form for the seller. It's saved as a draft for you to edit before publishing.
        </p>
        <FormField label="What should the form cover? (optional)" hint="Leave blank for due-diligence questions about what the documents leave out">
          <Textarea v-model="instructions" :rows="4" placeholder="e.g. Traffic sources and SEO history, supplier terms, and why they're selling" data-test="ai-form-instructions" />
        </FormField>
        <p v-if="drafting" class="text-sm text-muted-foreground flex items-center gap-2">
          <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" /> Drafting. This can take a minute.
        </p>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" :disabled="drafting" @click="showDraft = false">Cancel</Button>
          <Button type="submit" :loading="drafting">Draft form</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
