<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Business, BusinessStage, NextStep } from '~/shared/types'
import { STAGE_LABELS, STAGE_ORDER } from '~/shared/types'

const businessesStore = useBusinessesStore()
const { formatMoney, formatDate, isOverdue } = useFormatting()
const { getKanbanDotClass, getStatus } = useNextStepStatus()

await businessesStore.fetchBusinesses()

// Load active next steps for all businesses
const nextStepsMap = ref<Record<number, NextStep | null>>({})

async function loadNextSteps() {
  const results = await Promise.allSettled(
    businessesStore.businesses.map(async (b) => {
      const data = await $fetch<{ primary: NextStep | null }>(`/api/businesses/${b.id}/next-steps`)
      return { id: b.id, primary: data.primary }
    })
  )
  const map: Record<number, NextStep | null> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') map[r.value.id] = r.value.primary
  }
  nextStepsMap.value = map
}

loadNextSteps()

const columns = computed(() => {
  return STAGE_ORDER.map(stage => ({
    stage,
    label: STAGE_LABELS[stage],
    businesses: businessesStore.businesses.filter(b => b.stage === stage),
  }))
})

async function onDrop(event: { added?: { element: Business } }, toStage: BusinessStage) {
  if (!event.added) return
  const business = event.added.element
  const old = business.stage
  business.stage = toStage
  try {
    await businessesStore.updateStage(business.id, toStage)
  } catch {
    business.stage = old
  }
}

const stageColors: Record<BusinessStage, string> = {
  initial_interest: 'border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-500/10',
  qualified: 'border-blue-300 dark:border-blue-500/40 bg-blue-50/50 dark:bg-blue-500/10',
  rejected: 'border-red-300 dark:border-red-500/40 bg-red-50/50 dark:bg-red-500/10',
  seller_engaged: 'border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/10',
  offer_made: 'border-purple-300 dark:border-purple-500/40 bg-purple-50/50 dark:bg-purple-500/10',
  offer_accepted: 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-500/10',
  offer_rejected: 'border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/10',
}

const stageHeaderColors: Record<BusinessStage, string> = {
  initial_interest: 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/15',
  qualified: 'text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/15',
  rejected: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-500/15',
  seller_engaged: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15',
  offer_made: 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/15',
  offer_accepted: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/15',
  offer_rejected: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/15',
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="p-6 pb-4 border-b shrink-0">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">Pipeline</h1>
          <p class="text-muted-foreground">Drag cards to update stages</p>
        </div>
        <NuxtLink to="/businesses/new">
          <Button>
            <Icon name="lucide:plus" class="h-4 w-4" />
            Add Business
          </Button>
        </NuxtLink>
      </div>
    </div>

    <div class="flex-1 overflow-x-auto p-4">
      <div class="flex gap-4 h-full min-w-max">
        <div
          v-for="col in columns"
          :key="col.stage"
          class="w-72 flex flex-col"
        >
          <!-- Column header -->
          <div :class="['rounded-t-lg px-3 py-2 flex items-center justify-between border-b-0', stageHeaderColors[col.stage as BusinessStage]]">
            <span class="text-sm font-semibold">{{ col.label }}</span>
            <span class="text-xs font-bold rounded-full px-1.5 py-0.5 bg-white/60 dark:bg-black/30">{{ col.businesses.length }}</span>
          </div>

          <!-- Cards -->
          <draggable
            v-model="(columns.find(c => c.stage === col.stage)!.businesses as Business[])"
            group="businesses"
            item-key="id"
            :class="['flex-1 rounded-b-lg border-2 border-t-0 p-2 space-y-2 min-h-32 overflow-y-auto', stageColors[col.stage as BusinessStage]]"
            @change="(e: { added?: { element: Business } }) => onDrop(e, col.stage as BusinessStage)"
          >
            <template #item="{ element }">
              <div class="bg-card rounded-md border shadow-sm hover:shadow-md transition-shadow">
                <NuxtLink :to="`/businesses/${element.id}`" class="block p-3">
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <p class="font-medium text-sm leading-tight">{{ element.name }}</p>
                    <CategoryBadge :category="element.category" />
                  </div>
                  <div class="space-y-1">
                    <div v-if="element.asking_price" class="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="lucide:dollar-sign" class="h-3 w-3" />
                      {{ formatMoney(element.asking_price) }}
                    </div>
                    <div v-if="element.platform" class="flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="lucide:globe" class="h-3 w-3" />
                      {{ element.platform }}
                    </div>
                    <div
                      v-if="element.follow_up_date"
                      :class="['flex items-center gap-1 text-xs', isOverdue(element.follow_up_date) ? 'text-destructive font-semibold' : 'text-muted-foreground']"
                    >
                      <Icon name="lucide:calendar" class="h-3 w-3" />
                      {{ formatDate(element.follow_up_date) }}
                    </div>
                  </div>
                </NuxtLink>

                <!-- Next step indicator + context menu -->
                <div class="flex items-center justify-between px-3 pb-2 gap-2">
                  <div class="flex-1 min-w-0">
                    <template v-if="nextStepsMap[element.id]">
                      <div
                        :class="['flex items-center gap-1 text-xs font-medium', getKanbanDotClass(nextStepsMap[element.id]?.due_date, 'pending')]"
                        :title="nextStepsMap[element.id]?.title + (nextStepsMap[element.id]?.notes ? '\n' + nextStepsMap[element.id]?.notes : '')"
                      >
                        <Icon name="lucide:target" class="h-3 w-3 shrink-0" />
                        <span class="truncate">{{ nextStepsMap[element.id]?.due_date }}</span>
                      </div>
                    </template>
                    <div v-else-if="element.id in nextStepsMap" class="flex items-center gap-1 text-xs text-muted-foreground/50">
                      <Icon name="lucide:target" class="h-3 w-3" />
                      <span>No next step</span>
                    </div>
                  </div>
                  <BusinessCardMenu
                    :business-id="element.id"
                    :business-name="element.name"
                    :active-step="nextStepsMap[element.id] || null"
                    @updated="loadNextSteps"
                  />
                </div>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>
  </div>
</template>
