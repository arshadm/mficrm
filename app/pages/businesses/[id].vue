<script setup lang="ts">
import type { Business } from '~/shared/types'
import { STAGE_LABELS, CATEGORY_LABELS, STAGE_ORDER } from '~/shared/types'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const idRef = computed(() => id.value)

const { business, loading, saving, fetchBusiness, saveBusiness } = useBusiness(idRef)
const { data: businessCase, saving: savingCase, fetch: fetchCase, save: saveCase } = useBusinessCase(idRef)
const { data: growthPlan, saving: savingGrowth, fetch: fetchGrowth, save: saveGrowth } = useGrowthPlan(idRef)
const { data: workingCapital, saving: savingCapital, fetch: fetchCapital, save: saveCapital } = useWorkingCapital(idRef)
const { data: valuation, saving: savingValuation, fetch: fetchValuation, save: saveValuation } = useValuation(idRef)
const { risks, loading: loadingRisks, fetchRisks, addRisk, updateRisk, deleteRisk } = useRisks(idRef)
const { interactions, loading: loadingInteractions, fetchInteractions, addInteraction, deleteInteraction } = useInteractions(idRef)

// Support ?tab=next-steps query param for deep linking
const activeTab = ref((route.query.tab as string) || 'overview')

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'lucide:info' },
  { id: 'next-steps', label: 'Next Steps', icon: 'lucide:target' },
  { id: 'case', label: 'Business Case', icon: 'lucide:file-text' },
  { id: 'growth', label: 'Growth Plan', icon: 'lucide:trending-up' },
  { id: 'capital', label: 'Working Capital', icon: 'lucide:wallet' },
  { id: 'risks', label: 'Risk Checklist', icon: 'lucide:shield-alert' },
  { id: 'valuation', label: 'Valuation', icon: 'lucide:bar-chart-2' },
  { id: 'interactions', label: 'Interactions', icon: 'lucide:message-circle' },
]

await fetchBusiness()

watch(activeTab, async (tab) => {
  if (tab === 'case' && !businessCase.value) await fetchCase()
  if (tab === 'growth' && !growthPlan.value) await fetchGrowth()
  if (tab === 'capital' && !workingCapital.value) await fetchCapital()
  if (tab === 'risks' && !risks.value.length) await fetchRisks()
  if (tab === 'valuation' && !valuation.value) await fetchValuation()
  if (tab === 'interactions' && !interactions.value.length) await fetchInteractions()
})

// Overview form
const form = reactive<Partial<Business>>({})

watch(business, (b) => {
  if (b) Object.assign(form, b)
}, { immediate: true })

const { formatMoney, formatDate, formatDateTime } = useFormatting()

const stageOptions = STAGE_ORDER.map(s => ({ value: s, label: STAGE_LABELS[s] }))
const categoryOptions = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))

async function handleSaveOverview() {
  if (!business.value) return
  await saveBusiness(form)
}

// Working capital computed total
const capitalTotal = computed(() => {
  if (!workingCapital.value) return 0
  return [
    workingCapital.value.acquisition_cost,
    workingCapital.value.legal_fees,
    workingCapital.value.transition_costs,
    workingCapital.value.initial_marketing_budget,
    workingCapital.value.tech_infrastructure,
    workingCapital.value.working_capital_buffer,
    workingCapital.value.other_costs,
  ].reduce((s, v) => s + (v || 0), 0)
})

// Risk management
const DEFAULT_RISKS = [
  { category: 'Supplier', description: 'Supplier concentration risk' },
  { category: 'Legal', description: 'Legal/IP issues' },
  { category: 'Technical', description: 'Technical debt' },
  { category: 'Team/Key Person', description: 'Key person dependency' },
  { category: 'Customer Concentration', description: '>20% revenue from single customer' },
  { category: 'Platform Dependency', description: 'Platform/algorithm dependency (Google/Amazon)' },
  { category: 'Traffic Source', description: 'Traffic source concentration risk' },
  { category: 'IP/Trademark', description: 'Trademark/brand IP issues' },
  { category: 'Regulatory', description: 'Regulatory/compliance risk' },
  { category: 'Financial', description: 'Financial irregularities or inconsistencies' },
]

const showAddRisk = ref(false)
const newRisk = reactive({ category: 'Custom', description: '' })

async function seedDefaultRisks() {
  for (const r of DEFAULT_RISKS) {
    await addRisk({ ...r, is_resolved: false })
  }
}

// Interaction modal
const showAddInteraction = ref(false)
const newInteraction = reactive({
  type: 'note',
  title: '',
  body: '',
  occurred_at: new Date().toISOString().slice(0, 16),
})
const interactionFiles = ref<FileList | null>(null)

const interactionTypeOptions = [
  { value: 'note', label: 'Note' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'document', label: 'Document' },
  { value: 'offer', label: 'Offer' },
  { value: 'other', label: 'Other' },
]

const interactionTypeIcons: Record<string, string> = {
  note: 'lucide:sticky-note',
  email: 'lucide:mail',
  call: 'lucide:phone',
  meeting: 'lucide:users',
  document: 'lucide:file',
  stage_change: 'lucide:git-merge',
  offer: 'lucide:handshake',
  other: 'lucide:circle',
}

async function handleAddInteraction() {
  if (!newInteraction.title && !newInteraction.body) return
  const interaction = await addInteraction({
    type: newInteraction.type as any,
    title: newInteraction.title || null,
    body: newInteraction.body || null,
    occurred_at: newInteraction.occurred_at ? new Date(newInteraction.occurred_at).toISOString() : undefined,
  })

  if (interactionFiles.value?.length) {
    const formData = new FormData()
    formData.append('interaction_id', String(interaction.id))
    for (const file of Array.from(interactionFiles.value)) {
      formData.append('files', file)
    }
    await $fetch(`/api/businesses/${id.value}/attachments`, { method: 'POST', body: formData })
    await fetchInteractions()
  }

  showAddInteraction.value = false
  Object.assign(newInteraction, { type: 'note', title: '', body: '', occurred_at: new Date().toISOString().slice(0, 16) })
  interactionFiles.value = null
}

async function handleArchive() {
  if (!confirm('Archive this business?')) return
  await saveBusiness({ is_archived: 1 } as any)
  await router.push('/businesses')
}

async function exportPdf() {
  window.open(`/api/businesses/${id.value}/export/pdf`, '_blank')
}

const unresolvedRisks = computed(() => risks.value.filter(r => !r.is_resolved).length)
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-20">
    <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <div v-else-if="!business" class="p-6">
    <EmptyState title="Business not found" icon="lucide:search" />
  </div>

  <div v-else class="flex flex-col h-full">
    <!-- Header -->
    <div class="border-b bg-card px-6 py-4 shrink-0">
      <div class="flex items-start justify-between gap-4 mb-3">
        <div class="flex items-center gap-3">
          <NuxtLink to="/businesses" class="text-muted-foreground hover:text-foreground">
            <Icon name="lucide:arrow-left" class="h-5 w-5" />
          </NuxtLink>
          <div>
            <h1 class="text-xl font-bold">{{ business.name }}</h1>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <StageBadge :stage="business.stage" />
              <CategoryBadge :category="business.category" />
              <span v-if="business.platform" class="text-xs text-muted-foreground">{{ business.platform }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" @click="exportPdf">
            <Icon name="lucide:file-down" class="h-4 w-4" />
            <span class="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" @click="handleArchive">
            <Icon name="lucide:archive" class="h-4 w-4" />
            <span class="hidden sm:inline">Archive</span>
          </Button>
        </div>
      </div>
      <StageProgress :stage="business.stage" />
    </div>

    <!-- Tabs -->
    <div class="flex-1 overflow-y-auto">
      <Tabs :tabs="tabs" v-model="activeTab" />

      <div class="p-6">

        <!-- TAB: Next Steps -->
        <div v-if="activeTab === 'next-steps'">
          <NextStepsTab :business-id="id" />
        </div>

        <!-- TAB: Overview -->
        <div v-if="activeTab === 'overview'" class="space-y-6 max-w-3xl">
          <form class="space-y-5" @submit.prevent="handleSaveOverview">
            <div class="grid sm:grid-cols-2 gap-4">
              <FormField label="Business Name" required>
                <Input v-model="form.name" />
              </FormField>
              <FormField label="Category" required>
                <Select v-model="form.category as string" :options="categoryOptions" />
              </FormField>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <FormField label="Stage">
                <Select v-model="form.stage as string" :options="stageOptions" />
              </FormField>
              <FormField label="Platform">
                <Input v-model="form.platform as string" placeholder="e.g. Empire Flippers" />
              </FormField>
            </div>
            <FormField label="Listing URL">
              <div class="flex gap-2">
                <Input v-model="form.listing_url as string" type="url" placeholder="https://" />
                <a v-if="form.listing_url" :href="form.listing_url" target="_blank" class="shrink-0">
                  <Button type="button" variant="outline" size="icon">
                    <Icon name="lucide:external-link" class="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </FormField>
            <div class="grid sm:grid-cols-3 gap-4">
              <FormField label="Asking Price ($)">
                <Input v-model.number="form.asking_price as number" type="number" />
              </FormField>
              <FormField label="T12M Revenue ($)">
                <Input v-model.number="form.trailing_12m_revenue as number" type="number" />
              </FormField>
              <FormField label="T12M Profit ($)">
                <Input v-model.number="form.trailing_12m_profit as number" type="number" />
              </FormField>
            </div>
            <div class="grid sm:grid-cols-2 gap-4">
              <FormField label="Date Listed">
                <Input v-model="form.date_listed as string" type="date" />
              </FormField>
              <FormField label="Follow-up Date">
                <Input v-model="form.follow_up_date as string" type="date" />
              </FormField>
            </div>
            <FormField label="Follow-up Note">
              <Input v-model="form.follow_up_note as string" placeholder="What to follow up on..." />
            </FormField>
            <FormField label="Description">
              <Textarea v-model="form.description as string" :rows="4" />
            </FormField>
            <Button type="submit" :loading="saving">Save Changes</Button>
          </form>
        </div>

        <!-- TAB: Business Case -->
        <div v-if="activeTab === 'case'" class="space-y-6 max-w-3xl">
          <div v-if="!businessCase" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>
          <template v-else>
            <FormField label="Strategic Rationale">
              <TiptapEditor v-model="businessCase.strategic_rationale" placeholder="Why acquire this business?" />
            </FormField>
            <FormField label="Target Market">
              <TiptapEditor v-model="businessCase.target_market" placeholder="Describe the target market..." />
            </FormField>
            <FormField label="Competitive Advantage">
              <TiptapEditor v-model="businessCase.competitive_advantage" placeholder="What makes this business stand out?" />
            </FormField>
            <FormField label="Key Risks">
              <TiptapEditor v-model="businessCase.key_risks" placeholder="Outline the main risks..." />
            </FormField>
            <FormField label="Assumptions">
              <TiptapEditor v-model="businessCase.assumptions" placeholder="List key assumptions..." />
            </FormField>
            <Button :loading="savingCase" @click="saveCase(businessCase)">Save Business Case</Button>
          </template>
        </div>

        <!-- TAB: Growth Plan -->
        <div v-if="activeTab === 'growth'" class="space-y-6 max-w-3xl">
          <div v-if="!growthPlan" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>
          <template v-else>
            <FormField label="Year 1 Goals">
              <TiptapEditor v-model="growthPlan.year1_goals" placeholder="What will you achieve in Year 1?" />
            </FormField>
            <FormField label="Year 2 Goals">
              <TiptapEditor v-model="growthPlan.year2_goals" placeholder="Year 2 targets..." />
            </FormField>
            <FormField label="Marketing Strategy">
              <TiptapEditor v-model="growthPlan.marketing_strategy" placeholder="How will you grow the customer base?" />
            </FormField>
            <FormField label="Product Roadmap">
              <TiptapEditor v-model="growthPlan.product_roadmap" placeholder="Key product improvements..." />
            </FormField>
            <FormField label="Team Requirements">
              <Textarea v-model="growthPlan.team_requirements as string" :rows="3" placeholder="Headcount, roles needed..." />
            </FormField>
            <Button :loading="savingGrowth" @click="saveGrowth(growthPlan)">Save Growth Plan</Button>
          </template>
        </div>

        <!-- TAB: Working Capital -->
        <div v-if="activeTab === 'capital'" class="space-y-5 max-w-xl">
          <div v-if="!workingCapital" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>
          <template v-else>
            <div class="grid sm:grid-cols-2 gap-4">
              <FormField label="Acquisition Cost ($)">
                <Input v-model.number="workingCapital.acquisition_cost as number" type="number" />
              </FormField>
              <FormField label="Legal Fees ($)">
                <Input v-model.number="workingCapital.legal_fees as number" type="number" />
              </FormField>
              <FormField label="Transition Costs ($)">
                <Input v-model.number="workingCapital.transition_costs as number" type="number" />
              </FormField>
              <FormField label="Initial Marketing Budget ($)">
                <Input v-model.number="workingCapital.initial_marketing_budget as number" type="number" />
              </FormField>
              <FormField label="Tech Infrastructure ($)">
                <Input v-model.number="workingCapital.tech_infrastructure as number" type="number" />
              </FormField>
              <FormField label="Working Capital Buffer ($)">
                <Input v-model.number="workingCapital.working_capital_buffer as number" type="number" />
              </FormField>
              <FormField label="Other Costs ($)">
                <Input v-model.number="workingCapital.other_costs as number" type="number" />
              </FormField>
              <FormField label="Other Costs Notes">
                <Input v-model="workingCapital.other_costs_notes as string" placeholder="Describe other costs..." />
              </FormField>
            </div>
            <FormField label="Funding Source">
              <Input v-model="workingCapital.funding_source as string" placeholder="e.g. SBA loan, cash, investors..." />
            </FormField>

            <!-- Total -->
            <Card class="p-4 bg-primary/5">
              <div class="flex items-center justify-between">
                <span class="font-semibold">Total Estimated Cost</span>
                <span class="text-2xl font-bold text-primary">{{ useFormatting().formatMoney(capitalTotal) }}</span>
              </div>
            </Card>

            <Button :loading="savingCapital" @click="saveCapital(workingCapital)">Save Working Capital</Button>
          </template>
        </div>

        <!-- TAB: Risk Checklist -->
        <div v-if="activeTab === 'risks'" class="space-y-4 max-w-2xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold">Risk Checklist</h2>
              <p v-if="unresolvedRisks > 0" class="text-sm text-destructive font-medium">
                {{ unresolvedRisks }} unresolved risk{{ unresolvedRisks !== 1 ? 's' : '' }}
              </p>
              <p v-else-if="risks.length" class="text-sm text-emerald-600 dark:text-emerald-300 font-medium">All risks resolved</p>
            </div>
            <div class="flex gap-2">
              <Button v-if="!risks.length" variant="outline" size="sm" @click="seedDefaultRisks">
                Load Defaults
              </Button>
              <Button size="sm" @click="showAddRisk = true">
                <Icon name="lucide:plus" class="h-4 w-4" />
                Add Risk
              </Button>
            </div>
          </div>

          <div v-if="loadingRisks" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>

          <div v-else-if="!risks.length">
            <EmptyState
              icon="lucide:shield"
              title="No risks added"
              description="Add default risk items or create custom ones"
            />
          </div>

          <div v-else class="space-y-2">
            <Card
              v-for="risk in risks"
              :key="risk.id"
              :class="['p-4', risk.is_resolved ? 'opacity-60' : '']"
            >
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  :checked="!!risk.is_resolved"
                  class="mt-1 rounded"
                  @change="updateRisk(risk.id, { is_resolved: !risk.is_resolved, resolved_note: risk.resolved_note })"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide">{{ risk.category }}</span>
                  </div>
                  <p :class="['text-sm', risk.is_resolved ? 'line-through text-muted-foreground' : '']">
                    {{ risk.description }}
                  </p>
                  <input
                    v-if="risk.is_resolved"
                    :value="risk.resolved_note || ''"
                    type="text"
                    placeholder="Resolution note..."
                    class="mt-1 text-xs border-0 border-b border-dashed bg-transparent focus:outline-none w-full text-muted-foreground"
                    @change="updateRisk(risk.id, { resolved_note: ($event.target as HTMLInputElement).value })"
                  />
                </div>
                <button
                  class="text-muted-foreground hover:text-destructive shrink-0"
                  @click="deleteRisk(risk.id)"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                </button>
              </div>
            </Card>
          </div>

          <!-- Add risk modal -->
          <Modal :open="showAddRisk" title="Add Custom Risk" @close="showAddRisk = false">
            <div class="p-6 space-y-4">
              <FormField label="Category">
                <Input v-model="newRisk.category" placeholder="e.g. Financial, Legal..." />
              </FormField>
              <FormField label="Description" required>
                <Textarea v-model="newRisk.description" placeholder="Describe the risk..." />
              </FormField>
              <div class="flex gap-3">
                <Button @click="addRisk({ ...newRisk }); Object.assign(newRisk, { category: 'Custom', description: '' }); showAddRisk = false">
                  Add Risk
                </Button>
                <Button variant="outline" @click="showAddRisk = false">Cancel</Button>
              </div>
            </div>
          </Modal>
        </div>

        <!-- TAB: Valuation -->
        <div v-if="activeTab === 'valuation'" class="space-y-5 max-w-xl">
          <div v-if="!valuation" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>
          <template v-else>
            <FormField label="Valuation Method">
              <Select
                v-model="valuation.valuation_method as string"
                :options="[
                  { value: 'Revenue Multiple', label: 'Revenue Multiple' },
                  { value: 'Profit Multiple', label: 'Profit Multiple' },
                  { value: 'DCF', label: 'DCF' },
                  { value: 'Asset-Based', label: 'Asset-Based' },
                ]"
                placeholder="Select method"
              />
            </FormField>

            <div class="grid grid-cols-3 gap-4">
              <FormField label="Low ($)">
                <Input v-model.number="valuation.estimated_value_low as number" type="number" />
              </FormField>
              <FormField label="Mid ($)">
                <Input v-model.number="valuation.estimated_value_mid as number" type="number" />
              </FormField>
              <FormField label="High ($)">
                <Input v-model.number="valuation.estimated_value_high as number" type="number" />
              </FormField>
            </div>

            <!-- Range bar -->
            <div v-if="valuation.estimated_value_low || valuation.estimated_value_high" class="py-2">
              <div class="h-4 bg-muted rounded-full relative overflow-hidden">
                <div
                  class="absolute h-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-300 rounded-full"
                  :style="{
                    left: '0%',
                    width: '100%',
                  }"
                />
              </div>
              <div class="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{{ useFormatting().formatMoney(valuation.estimated_value_low) }}</span>
                <span class="font-semibold text-primary">{{ useFormatting().formatMoney(valuation.estimated_value_mid) }}</span>
                <span>{{ useFormatting().formatMoney(valuation.estimated_value_high) }}</span>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <FormField label="Initial Offer ($)">
                <Input v-model.number="valuation.initial_offer as number" type="number" />
              </FormField>
              <FormField label="Max Offer ($)">
                <Input v-model.number="valuation.max_offer as number" type="number" />
              </FormField>
              <FormField label="Final Offer Made ($)">
                <Input v-model.number="valuation.final_offer_made as number" type="number" />
              </FormField>
            </div>

            <FormField label="Offer Notes">
              <TiptapEditor v-model="valuation.offer_notes" placeholder="Notes about the offer..." />
            </FormField>

            <Button :loading="savingValuation" @click="saveValuation(valuation)">Save Valuation</Button>
          </template>
        </div>

        <!-- TAB: Interactions -->
        <div v-if="activeTab === 'interactions'" class="space-y-4 max-w-2xl">
          <div class="flex justify-between items-center">
            <h2 class="font-semibold">Interaction History</h2>
            <Button size="sm" @click="showAddInteraction = true">
              <Icon name="lucide:plus" class="h-4 w-4" />
              Add Interaction
            </Button>
          </div>

          <div v-if="loadingInteractions" class="flex justify-center py-8">
            <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin" />
          </div>

          <div v-else-if="!interactions.length">
            <EmptyState icon="lucide:message-circle" title="No interactions yet" description="Log your first note, call, or email" />
          </div>

          <div v-else class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <div class="space-y-4">
              <div
                v-for="interaction in interactions"
                :key="interaction.id"
                class="relative pl-10"
              >
                <div class="absolute left-0 w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                  <Icon :name="interactionTypeIcons[interaction.type] || 'lucide:circle'" class="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <Card class="p-4">
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span class="font-medium text-sm">{{ interaction.title || interaction.type }}</span>
                      <span class="ml-2 text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">{{ interaction.type }}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="text-xs text-muted-foreground">{{ formatDateTime(interaction.occurred_at) }}</span>
                      <button
                        class="text-muted-foreground hover:text-destructive"
                        @click="deleteInteraction(interaction.id)"
                      >
                        <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <RichText :content="interaction.body" />
                  <div v-if="interaction.attachments?.length" class="mt-3 space-y-1">
                    <a
                      v-for="att in interaction.attachments"
                      :key="att.id"
                      :href="`/uploads/${att.filename}`"
                      target="_blank"
                      class="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Icon name="lucide:paperclip" class="h-3.5 w-3.5" />
                      {{ att.original_name }}
                      <span class="text-muted-foreground">({{ att.file_size ? Math.round(att.file_size / 1024) + 'KB' : '' }})</span>
                    </a>
                  </div>
                  <p v-if="interaction.username" class="mt-2 text-xs text-muted-foreground">
                    by {{ interaction.username }}
                  </p>
                </Card>
              </div>
            </div>
          </div>

          <!-- Add interaction modal -->
          <Modal :open="showAddInteraction" title="Add Interaction" size="lg" @close="showAddInteraction = false">
            <div class="p-6 space-y-4">
              <div class="grid sm:grid-cols-2 gap-4">
                <FormField label="Type">
                  <Select v-model="newInteraction.type" :options="interactionTypeOptions" />
                </FormField>
                <FormField label="Date & Time">
                  <Input v-model="newInteraction.occurred_at" type="datetime-local" />
                </FormField>
              </div>
              <FormField label="Title">
                <Input v-model="newInteraction.title" placeholder="Brief summary..." />
              </FormField>
              <FormField label="Notes">
                <TiptapEditor v-model="newInteraction.body" placeholder="Add details..." />
              </FormField>
              <FormField label="Attachments">
                <input
                  type="file"
                  multiple
                  accept="*/*"
                  class="text-sm"
                  @change="interactionFiles = ($event.target as HTMLInputElement).files"
                />
                <p class="text-xs text-muted-foreground mt-1">Max 20MB per file</p>
              </FormField>
              <div class="flex gap-3">
                <Button @click="handleAddInteraction">Save Interaction</Button>
                <Button variant="outline" @click="showAddInteraction = false">Cancel</Button>
              </div>
            </div>
          </Modal>
        </div>

      </div>
    </div>
  </div>
</template>
