<script setup lang="ts">
import { STAGE_LABELS, CATEGORY_LABELS, STAGE_ORDER } from '~/shared/types'
import type { BusinessStage, BusinessCategory } from '~/shared/types'

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

const errors = ref<Record<string, string>>({})
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
