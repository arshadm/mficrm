<script setup lang="ts">
import type { Business, BusinessStage, BusinessCategory } from '~/shared/types'
import { STAGE_LABELS, CATEGORY_LABELS, STAGE_ORDER } from '~/shared/types'

const businessesStore = useBusinessesStore()
const { formatMoney, formatDate, isOverdue } = useFormatting()

const sortBy = ref('last_updated')
const sortDir = ref<'asc' | 'desc'>('desc')

onMounted(async () => {
  await businessesStore.fetchBusinesses()
})

watch(() => businessesStore.filters, async () => {
  await businessesStore.fetchBusinesses()
}, { deep: true })

function toggleSort(col: string) {
  if (sortBy.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    sortDir.value = 'desc'
  }
  businessesStore.filters.sort_by = col
  businessesStore.filters.sort_dir = sortDir.value
}

const stageOptions = STAGE_ORDER.map(s => ({ value: s, label: STAGE_LABELS[s] }))
const categoryOptions = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }))

const selectedIds = ref<Set<number>>(new Set())

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

function toggleAll() {
  if (selectedIds.value.size === businessesStore.businesses.length) {
    selectedIds.value.clear()
  } else {
    selectedIds.value = new Set(businessesStore.businesses.map(b => b.id))
  }
}

async function exportCsv() {
  const q = new URLSearchParams()
  if (businessesStore.filters.stage) q.set('stage', businessesStore.filters.stage)
  if (businessesStore.filters.category) q.set('category', businessesStore.filters.category)
  window.open(`/api/businesses/export/csv?${q}`, '_blank')
}

async function bulkArchive() {
  const ids = Array.from(selectedIds.value)
  await Promise.all(ids.map(id => $fetch(`/api/businesses/${id}`, { method: 'PATCH', body: { is_archived: 1 } })))
  selectedIds.value.clear()
  await businessesStore.fetchBusinesses()
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Businesses</h1>
        <p class="text-muted-foreground">{{ businessesStore.businesses.length }} records</p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="exportCsv">
          <Icon name="lucide:download" class="h-4 w-4" />
          Export CSV
        </Button>
        <NuxtLink to="/businesses/new">
          <Button size="sm">
            <Icon name="lucide:plus" class="h-4 w-4" />
            Add Business
          </Button>
        </NuxtLink>
      </div>
    </div>

    <!-- Filters -->
    <Card class="p-4">
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Input
          v-model="businessesStore.filters.search"
          placeholder="Search..."
          class="lg:col-span-2"
        />
        <Select
          v-model="businessesStore.filters.stage"
          :options="stageOptions"
          placeholder="All stages"
        />
        <Select
          v-model="businessesStore.filters.category"
          :options="categoryOptions"
          placeholder="All categories"
        />
        <Input v-model="businessesStore.filters.date_from" type="date" placeholder="From" />
        <Input v-model="businessesStore.filters.date_to" type="date" placeholder="To" />
      </div>
      <div v-if="Object.values(businessesStore.filters).some(v => v && v !== 'last_updated' && v !== 'desc')" class="mt-2">
        <Button
          variant="ghost"
          size="sm"
          @click="Object.assign(businessesStore.filters, { search: '', stage: '', category: '', platform: '', assigned_to: '', date_from: '', date_to: '' })"
        >
          <Icon name="lucide:x" class="h-3.5 w-3.5" />
          Clear filters
        </Button>
      </div>
    </Card>

    <!-- Bulk actions -->
    <div v-if="selectedIds.size > 0" class="flex items-center gap-3 p-3 bg-primary/5 rounded-md border border-primary/20">
      <span class="text-sm font-medium">{{ selectedIds.size }} selected</span>
      <Button variant="outline" size="sm" @click="bulkArchive">
        <Icon name="lucide:archive" class="h-4 w-4" />
        Archive
      </Button>
      <Button variant="ghost" size="sm" @click="selectedIds.clear()">Cancel</Button>
    </div>

    <!-- Table -->
    <Card class="overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/30">
              <th class="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  :checked="selectedIds.size === businessesStore.businesses.length && businessesStore.businesses.length > 0"
                  class="rounded"
                  @change="toggleAll"
                />
              </th>
              <th
                v-for="col in [
                  { key: 'name', label: 'Name' },
                  { key: 'category', label: 'Category' },
                  { key: 'stage', label: 'Stage' },
                  { key: 'platform', label: 'Platform' },
                  { key: 'asking_price', label: 'Asking Price' },
                  { key: 'trailing_12m_profit', label: 'T12M Profit' },
                  { key: 'follow_up_date', label: 'Follow-up' },
                  { key: 'last_updated', label: 'Updated' },
                ]"
                :key="col.key"
                class="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap"
                @click="toggleSort(col.key)"
              >
                <span class="flex items-center gap-1">
                  {{ col.label }}
                  <Icon
                    :name="sortBy === col.key ? (sortDir === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down') : 'lucide:chevrons-up-down'"
                    class="h-3.5 w-3.5"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-if="businessesStore.loading">
              <tr v-for="i in 5" :key="i" class="border-b">
                <td colspan="9" class="px-4 py-3">
                  <div class="h-4 bg-muted rounded animate-pulse" />
                </td>
              </tr>
            </template>
            <template v-else-if="!businessesStore.businesses.length">
              <tr>
                <td colspan="9" class="py-16">
                  <EmptyState
                    icon="lucide:briefcase"
                    title="No businesses found"
                    description="Add your first business acquisition opportunity"
                    action-label="Add Business"
                    @action="$router.push('/businesses/new')"
                  />
                </td>
              </tr>
            </template>
            <template v-else>
              <tr
                v-for="biz in businessesStore.businesses"
                :key="biz.id"
                class="border-b hover:bg-muted/30 transition-colors"
              >
                <td class="px-4 py-3">
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(biz.id)"
                    class="rounded"
                    @change="toggleSelect(biz.id)"
                    @click.stop
                  />
                </td>
                <td class="px-4 py-3">
                  <NuxtLink :to="`/businesses/${biz.id}`" class="font-medium hover:text-primary">
                    {{ biz.name }}
                  </NuxtLink>
                </td>
                <td class="px-4 py-3"><CategoryBadge :category="biz.category" /></td>
                <td class="px-4 py-3"><StageBadge :stage="biz.stage" /></td>
                <td class="px-4 py-3 text-muted-foreground">{{ biz.platform || '—' }}</td>
                <td class="px-4 py-3 font-medium">{{ formatMoney(biz.asking_price) }}</td>
                <td class="px-4 py-3">{{ formatMoney(biz.trailing_12m_profit) }}</td>
                <td class="px-4 py-3">
                  <span v-if="biz.follow_up_date" :class="isOverdue(biz.follow_up_date) ? 'text-destructive font-semibold' : 'text-muted-foreground'">
                    {{ formatDate(biz.follow_up_date) }}
                  </span>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="px-4 py-3 text-muted-foreground">{{ formatDate(biz.last_updated) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>
