<script setup lang="ts">
interface FormListRow {
  id: number
  name: string
  description: string | null
  status: 'draft' | 'published' | 'archived'
  latest_version: number | null
  has_unpublished_changes: boolean
  field_count: number
  updated_at: string
  created_by_username: string | null
  business_id: number | null
  business_name: string | null
}

const router = useRouter()
const { formatRelative } = useFormatting()
const showArchived = ref(false)

const requestFetch = useRequestFetch() // forwards the session cookie during server rendering
const { data: forms, pending, refresh } = await useAsyncData(
  'forms',
  () => requestFetch<FormListRow[]>('/api/forms', { query: showArchived.value ? { archived: '1' } : {} }),
  { watch: [showArchived] },
)

const creating = ref(false)
const showCreate = ref(false)
const newForm = reactive({ name: '', description: '' })
const createError = ref('')

async function createForm() {
  createError.value = ''
  creating.value = true
  try {
    const form = await $fetch<{ id: number }>('/api/forms', { method: 'POST', body: newForm })
    await router.push(`/forms/${form.id}`)
  } catch (e: unknown) {
    createError.value = (e as { data?: { message?: string } })?.data?.message || 'Could not create the form'
  } finally {
    creating.value = false
  }
}

const statusClass: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  archived: 'bg-muted text-muted-foreground',
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Forms</h1>
        <p class="text-muted-foreground">Build forms to send to sellers, brokers and others outside the CRM</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="showArchived = !showArchived">
          <Icon :name="showArchived ? 'lucide:list' : 'lucide:archive'" class="h-4 w-4" />
          {{ showArchived ? 'Active forms' : 'Archived' }}
        </Button>
        <Button size="sm" @click="showCreate = true">
          <Icon name="lucide:plus" class="h-4 w-4" />
          New form
        </Button>
      </div>
    </div>

    <div v-if="pending && !forms" class="flex justify-center py-16">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <EmptyState
      v-else-if="!forms?.length"
      icon="lucide:clipboard-list"
      :title="showArchived ? 'No archived forms' : 'No forms yet'"
      :description="showArchived ? undefined : 'Create a form, add questions, then publish it to start sending links.'"
      :action-label="showArchived ? undefined : 'New form'"
      @action="showCreate = true"
    />

    <Card v-else class="divide-y">
      <NuxtLink
        v-for="form in forms"
        :key="form.id"
        :to="`/forms/${form.id}`"
        class="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <Icon name="lucide:clipboard-list" class="h-5 w-5 text-muted-foreground shrink-0" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium truncate">{{ form.name }}</span>
            <span :class="['text-xs rounded-full px-2 py-0.5 font-medium capitalize', statusClass[form.status]]">{{ form.status }}</span>
            <span v-if="form.latest_version" class="text-xs text-muted-foreground">v{{ form.latest_version }}</span>
            <span v-if="form.has_unpublished_changes" class="text-xs text-amber-700 dark:text-amber-300">· unpublished changes</span>
            <span v-if="form.business_name" class="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="lucide:building-2" class="h-3 w-3" />{{ form.business_name }}
            </span>
          </div>
          <p v-if="form.description" class="text-sm text-muted-foreground truncate">{{ form.description }}</p>
        </div>
        <div class="text-right text-xs text-muted-foreground shrink-0 hidden sm:block">
          <div>{{ form.field_count }} field{{ form.field_count === 1 ? '' : 's' }}</div>
          <div>Updated {{ formatRelative(form.updated_at) }}</div>
        </div>
        <Icon name="lucide:chevron-right" class="h-4 w-4 text-muted-foreground shrink-0" />
      </NuxtLink>
    </Card>

    <Modal :open="showCreate" title="New form" size="md" @close="showCreate = false">
      <form class="space-y-4 p-6" @submit.prevent="createForm">
        <FormField label="Name" required>
          <Input v-model="newForm.name" placeholder="e.g. Seller information request" />
        </FormField>
        <FormField label="Description" hint="Shown at the top of the form">
          <Textarea v-model="newForm.description" :rows="3" />
        </FormField>
        <p v-if="createError" class="text-sm text-destructive">{{ createError }}</p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" @click="showCreate = false">Cancel</Button>
          <Button type="submit" :loading="creating" :disabled="!newForm.name.trim()">Create and edit</Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
