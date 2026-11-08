<script setup lang="ts">
import { STAGE_LABELS, CATEGORY_LABELS, STAGE_ORDER } from '~/shared/types'
import type { BusinessStage, BusinessCategory } from '~/shared/types'
import type { AiPrefill } from '~/shared/ai'

const router = useRouter()
const businessesStore = useBusinessesStore()

const form = reactive({
  name: '',
  category: '' as BusinessCategory,
  stage: 'initial_interest' as BusinessStage,
  description: '',
  listing_url: '',
  asking_price: null as number | null,
  trailing_12m_revenue: null as number | null,
  trailing_12m_profit: null as number | null,
  platform: '',
  date_listed: '',
  follow_up_date: '',
  follow_up_note: '',
})

const documents = ref<File[]>([])
const errors = ref<Record<string, string>>({})

// AI prefill from the chosen documents (mficrm-b6g.4): fills only fields that are still empty
const { configured, loadStatus } = useAi()
onMounted(loadStatus)
const prefilling = ref(false)
const prefillError = ref('')
const prefillResult = ref<{ filled: string[], notes: string[], skipped: { name: string, reason: string }[] } | null>(null)
const PREFILL_LABELS: Record<string, string> = {
  name: 'name', category: 'category', platform: 'platform', listing_url: 'listing URL', asking_price: 'asking price',
  trailing_12m_revenue: 'revenue', trailing_12m_profit: 'profit', date_listed: 'date listed', description: 'description',
}

async function prefill() {
  prefillError.value = ''
  prefillResult.value = null
  prefilling.value = true
  try {
    const body = new FormData()
    for (const f of documents.value) body.append('files', f, f.name)
    const res = await $fetch<{ fields: AiPrefill, skipped: { name: string, reason: string }[] }>('/api/ai/prefill', { method: 'POST', body })
    const filled: string[] = []
    const target = form as Record<string, unknown>
    for (const key of Object.keys(PREFILL_LABELS)) {
      const value = res.fields[key as keyof AiPrefill]
      const current = target[key]
      if (value === null || value === undefined || value === '') continue
      if (current !== '' && current !== null && current !== undefined) continue
      if (key === 'date_listed' && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) continue
      target[key] = value
      filled.push(PREFILL_LABELS[key]!)
    }
    prefillResult.value = { filled, notes: res.fields.notes, skipped: res.skipped }
  } catch (e) {
    prefillError.value = errorMessage(e, 'Claude could not read the documents')
  } finally {
    prefilling.value = false
  }
}
const saving = ref(false)

const stageOptions = STAGE_ORDER.map(s => ({ value: s, label: STAGE_LABELS[s] }))
const categoryOptions = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))

async function handleSubmit() {
  errors.value = {}
  if (!form.name.trim()) { errors.value.name = 'Name is required'; return }
  if (!form.category) { errors.value.category = 'Category is required'; return }

  saving.value = true
  try {
    const business = await businessesStore.createBusiness({
      ...form,
      asking_price: form.asking_price || null,
      trailing_12m_revenue: form.trailing_12m_revenue || null,
      trailing_12m_profit: form.trailing_12m_profit || null,
      listing_url: form.listing_url || null,
      platform: form.platform || null,
      date_listed: form.date_listed || null,
      follow_up_date: form.follow_up_date || null,
      follow_up_note: form.follow_up_note || null,
      description: form.description || null,
    })
    // Documents are uploaded once the company exists; a failure leaves the company in place and opens its
    // Documents tab so they can be added again
    if (documents.value.length) {
      const body = new FormData()
      for (const f of documents.value) body.append('files', f, f.name)
      try {
        await $fetch(`/api/businesses/${business.id}/documents`, { method: 'POST', body })
      } catch (e: unknown) {
        alert(`The company was created, but its documents could not be uploaded: ${(e as { data?: { message?: string } })?.data?.message || 'upload failed'}`)
        await router.push(`/businesses/${business.id}?tab=documents`)
        return
      }
    }
    await router.push(`/businesses/${business.id}`)
  } catch (e: unknown) {
    errors.value.general = (e as Error).message || 'Failed to create business'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-2xl">
    <div class="mb-6">
      <button class="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4" @click="$router.back()">
        <Icon name="lucide:arrow-left" class="h-4 w-4" />
        Back
      </button>
      <h1 class="text-2xl font-bold">Add Business</h1>
    </div>

    <Card class="p-6">
      <form class="space-y-5" @submit.prevent="handleSubmit">
        <div v-if="errors.general" class="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {{ errors.general }}
        </div>

        <FormField label="Documents" hint="Optional. PDF, CSV or Excel, up to 20 MB each. Kept with the company.">
          <DocumentPicker v-model="documents" />
        </FormField>
        <div v-if="configured && documents.length" class="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2" data-test="ai-prefill">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <p class="text-sm">Let Claude fill in the details below from these documents.</p>
            <Button type="button" size="sm" :loading="prefilling" data-test="ai-prefill-button" @click="prefill">
              <Icon name="lucide:sparkles" class="h-4 w-4" />
              Fill in from documents
            </Button>
          </div>
          <p v-if="prefilling" class="text-xs text-muted-foreground">Reading the documents. This can take up to a minute.</p>
          <p v-if="prefillError" class="text-sm text-destructive">{{ prefillError }}</p>
          <div v-if="prefillResult" class="text-sm space-y-1">
            <p class="text-green-700 dark:text-green-300">
              {{ prefillResult.filled.length ? `Filled in: ${prefillResult.filled.join(', ')}.` : 'Nothing new to fill in.' }} Check the values before saving.
            </p>
            <ul v-if="prefillResult.notes.length" class="list-disc pl-5 text-muted-foreground text-xs space-y-0.5">
              <li v-for="(n, i) in prefillResult.notes" :key="i">{{ n }}</li>
            </ul>
            <p v-if="prefillResult.skipped.length" class="text-xs text-amber-700 dark:text-amber-300">
              Not read: {{ prefillResult.skipped.map(s => `${s.name} (${s.reason})`).join(', ') }}
            </p>
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <FormField label="Business Name" required :error="errors.name">
            <Input v-model="form.name" placeholder="e.g. ContentFlow Pro" />
          </FormField>
          <FormField label="Category" required :error="errors.category">
            <Select v-model="form.category" :options="categoryOptions" placeholder="Select category" />
          </FormField>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <FormField label="Stage">
            <Select v-model="form.stage" :options="stageOptions" />
          </FormField>
          <FormField label="Platform">
            <Input v-model="form.platform" placeholder="e.g. Empire Flippers" />
          </FormField>
        </div>

        <FormField label="Listing URL">
          <Input v-model="form.listing_url" type="url" placeholder="https://" />
        </FormField>

        <div class="grid sm:grid-cols-3 gap-4">
          <FormField label="Asking Price ($)">
            <Input v-model.number="form.asking_price" type="number" placeholder="0" />
          </FormField>
          <FormField label="T12M Revenue ($)">
            <Input v-model.number="form.trailing_12m_revenue" type="number" placeholder="0" />
          </FormField>
          <FormField label="T12M Profit ($)">
            <Input v-model.number="form.trailing_12m_profit" type="number" placeholder="0" />
          </FormField>
        </div>

        <div class="grid sm:grid-cols-2 gap-4">
          <FormField label="Date Listed">
            <Input v-model="form.date_listed" type="date" />
          </FormField>
          <FormField label="Follow-up Date">
            <Input v-model="form.follow_up_date" type="date" />
          </FormField>
        </div>

        <FormField label="Follow-up Note">
          <Input v-model="form.follow_up_note" placeholder="What to follow up on..." />
        </FormField>

        <FormField label="Description">
          <Textarea v-model="form.description" :rows="3" placeholder="Brief description of the business..." />
        </FormField>

        <div class="flex gap-3 pt-2">
          <Button type="submit" :loading="saving">Create Business</Button>
          <Button type="button" variant="outline" @click="$router.back()">Cancel</Button>
        </div>
      </form>
    </Card>
  </div>
</template>
