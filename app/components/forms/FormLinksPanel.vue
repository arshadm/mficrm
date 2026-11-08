<script setup lang="ts">
// Form links sent for a business or for a form, with their status and a revoke action (mficrm-xln.4)
// canSend defaults to true (an absent Boolean prop would otherwise be cast to false)
const props = withDefaults(defineProps<{ businessId?: number, formId?: number, canSend?: boolean }>(), { canSend: true })

interface FormLinkRow {
  id: number
  form_id: number
  form_name: string
  version: number
  business_id: number | null
  business_name: string | null
  recipient_name: string | null
  recipient_email: string | null
  status: 'sent' | 'opened' | 'submitted' | 'revoked' | 'expired'
  expires_at: string
  emailed_at: string | null
  submitted_at: string | null
  created_at: string
  created_by_username: string | null
  submission_id: number | null
}

const { formatDate, formatDateTime } = useFormatting()
const links = ref<FormLinkRow[]>([])
const loading = ref(true)
const showSend = ref(false)

async function load() {
  loading.value = true
  try {
    links.value = await $fetch<FormLinkRow[]>('/api/form-requests', {
      query: { business_id: props.businessId, form_id: props.formId },
    })
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function revoke(link: FormLinkRow) {
  if (!confirm(`Revoke the link${link.recipient_name ? ` sent to ${link.recipient_name}` : ''}? It will stop working immediately.`)) return
  await $fetch(`/api/form-requests/${link.id}/revoke`, { method: 'POST' })
  await load()
}

const statusClass: Record<FormLinkRow['status'], string> = {
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  opened: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  submitted: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  revoked: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold">Form links</h2>
      <Button v-if="canSend" size="sm" @click="showSend = true">
        <Icon name="lucide:send" class="h-4 w-4" />
        Send a form
      </Button>
    </div>

    <div v-if="loading" class="flex justify-center py-6">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
    <p v-else-if="!links.length" class="text-sm text-muted-foreground py-4">No links sent yet.</p>

    <div v-else class="divide-y rounded-md border" data-test="form-links">
      <div v-for="link in links" :key="link.id" class="flex items-center gap-3 px-3 py-2.5 text-sm" :data-link="link.id">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium truncate">{{ link.recipient_name || link.recipient_email || 'No recipient' }}</span>
            <span :class="['text-xs rounded-full px-2 py-0.5 font-medium capitalize', statusClass[link.status]]">{{ link.status }}</span>
          </div>
          <div class="text-xs text-muted-foreground truncate">
            <template v-if="!formId">{{ link.form_name }} v{{ link.version }} · </template>
            <template v-if="!businessId && link.business_name">
              <NuxtLink :to="`/businesses/${link.business_id}`" class="hover:underline">{{ link.business_name }}</NuxtLink> ·
            </template>
            <template v-if="link.recipient_name && link.recipient_email">{{ link.recipient_email }} · </template>
            <span :title="formatDateTime(link.created_at)">Created {{ formatDate(link.created_at) }}</span>
            <template v-if="link.emailed_at"> · emailed</template>
            <template v-if="link.status === 'submitted'"> · submitted {{ formatDate(link.submitted_at) }}</template>
            <template v-else-if="link.status === 'sent' || link.status === 'opened'"> · expires {{ formatDate(link.expires_at) }}</template>
          </div>
        </div>
        <NuxtLink v-if="link.submission_id" :to="`/forms/submissions/${link.submission_id}`">
          <Button variant="outline" size="sm">View answers</Button>
        </NuxtLink>
        <Button
          v-if="link.status === 'sent' || link.status === 'opened'"
          variant="ghost"
          size="sm"
          class="text-destructive"
          @click="revoke(link)"
        >
          Revoke
        </Button>
      </div>
    </div>

    <SendFormModal :open="showSend" :business-id="businessId" :form-id="formId" @close="showSend = false" @created="load" />
  </div>
</template>
