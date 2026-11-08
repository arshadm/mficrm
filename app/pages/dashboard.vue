<script setup lang="ts">
import type { TodayAction } from '~/shared/types'

const { formatMoney, formatDate, isOverdue } = useFormatting()
const { getStatus } = useNextStepStatus()

const { data: stats, pending } = await useFetch('/api/dashboard/stats')
const { data: todayActions, refresh: refreshTodayActions } = await useFetch<TodayAction[]>('/api/dashboard/today-actions')

const stageChartData = computed(() => {
  if (!stats.value) return { labels: [], datasets: [] }
  const byStage = stats.value.byStage as Array<{ stage: string, count: number }>
  return {
    labels: byStage.map(s => s.stage.replace(/_/g, ' ')),
    datasets: [{
      label: 'Businesses',
      data: byStage.map(s => s.count),
      backgroundColor: [
        '#6366f1', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#f43f5e'
      ],
    }],
  }
})

const categoryChartData = computed(() => {
  if (!stats.value) return { labels: [], datasets: [] }
  const byCategory = stats.value.byCategory as Array<{ category: string, count: number }>
  return {
    labels: byCategory.map(c => c.category),
    datasets: [{
      data: byCategory.map(c => c.count),
      backgroundColor: [
        '#f97316', '#0ea5e9', '#8b5cf6', '#22c55e', '#eab308',
        '#ec4899', '#6366f1', '#06b6d4', '#f43f5e', '#9ca3af'
      ],
    }],
  }
})

const { Bar, Pie } = await import('vue-chartjs')
const { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } = await import('chart.js')
Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

// Chart.js draws on a canvas, so it can't use the CSS theme tokens: pick label, grid and slice-border colours per mode
const colorMode = useColorMode()
const chartTheme = computed(() => colorMode.value === 'dark'
  ? { text: '#94a3b8', grid: 'rgba(148, 163, 184, 0.15)', sliceBorder: '#0f172a' }
  : { text: '#64748b', grid: 'rgba(0, 0, 0, 0.08)', sliceBorder: '#ffffff' })

const barOptions = computed(() => ({
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: chartTheme.value.text }, grid: { color: chartTheme.value.grid } },
    y: { ticks: { color: chartTheme.value.text }, grid: { color: chartTheme.value.grid } },
  },
}))

const pieOptions = computed(() => ({
  responsive: true,
  borderColor: chartTheme.value.sliceBorder,
  plugins: { legend: { labels: { color: chartTheme.value.text } } },
}))

// Complete action modal
const showCompleteModal = ref(false)
const completingAction = ref<TodayAction | null>(null)
const completionNote = ref('')
const completing = ref(false)

function openCompleteModal(action: TodayAction) {
  completingAction.value = action
  completionNote.value = ''
  showCompleteModal.value = true
}

async function handleComplete() {
  if (!completingAction.value) return
  completing.value = true
  try {
    await $fetch(`/api/businesses/${completingAction.value.business_id}/next-steps/${completingAction.value.step_id}/complete`, {
      method: 'POST',
      body: { completion_note: completionNote.value || undefined },
    })
    showCompleteModal.value = false
    await refreshTodayActions()
  } finally {
    completing.value = false
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold">Dashboard</h1>
      <p class="text-muted-foreground">Overview of your acquisition pipeline</p>
    </div>

    <!-- TODAY'S ACTIONS — prominently at top -->
    <Card class="p-5 border-2" :class="todayActions?.length ? 'border-amber-300/50 dark:border-amber-500/40 bg-amber-50/30 dark:bg-amber-500/10' : 'border-border'">
      <div class="flex items-center gap-2 mb-4">
        <Icon name="lucide:zap" class="h-5 w-5 text-amber-500" />
        <h2 class="font-semibold">Today's Actions</h2>
        <span v-if="todayActions?.length" class="ml-auto text-xs bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
          {{ todayActions.length }} due
        </span>
      </div>

      <div v-if="!todayActions?.length" class="text-center py-6">
        <Icon name="lucide:sun" class="h-8 w-8 text-amber-300 mx-auto mb-2" />
        <p class="text-sm text-muted-foreground">Nothing due today — check the <NuxtLink to="/calendar" class="text-primary hover:underline">calendar</NuxtLink> for upcoming actions</p>
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="action in todayActions"
          :key="action.step_id"
          class="flex items-center gap-3 p-3 rounded-md border bg-background"
        >
          <CategoryBadge :category="(action.business_category as any)" />
          <div class="flex-1 min-w-0">
            <NuxtLink :to="`/businesses/${action.business_id}?tab=next-steps`" class="font-medium text-sm hover:text-primary">
              {{ action.business_name }}
            </NuxtLink>
            <p class="text-xs text-muted-foreground truncate">{{ action.step_title }}</p>
          </div>
          <span :class="['text-xs shrink-0 font-medium', getStatus(action.due_date, 'pending').isOverdue ? 'text-destructive' : 'text-amber-600 dark:text-amber-300']">
            {{ getStatus(action.due_date, 'pending').isOverdue ? 'Overdue' : 'Due today' }}
          </span>
          <Button size="sm" variant="outline" class="shrink-0 h-7 text-xs" @click="openCompleteModal(action)">
            <Icon name="lucide:check" class="h-3.5 w-3.5" />
            Done
          </Button>
        </div>
      </div>
    </Card>

    <div v-if="pending" class="flex items-center justify-center py-20">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="stats">
      <!-- Stats cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card class="p-5">
          <p class="text-sm text-muted-foreground">Total Tracked</p>
          <p class="text-3xl font-bold mt-1">{{ stats.total }}</p>
        </Card>
        <Card class="p-5">
          <p class="text-sm text-muted-foreground">Total Pipeline Value</p>
          <p class="text-3xl font-bold mt-1">{{ formatMoney(stats.totalAskingPrice as number) }}</p>
        </Card>
        <Card class="p-5">
          <p class="text-sm text-muted-foreground">Est. Mid Value</p>
          <p class="text-3xl font-bold mt-1">{{ formatMoney(stats.totalMidValue as number) }}</p>
        </Card>
        <Card class="p-5">
          <p class="text-sm text-muted-foreground">Follow-ups Due</p>
          <p class="text-3xl font-bold mt-1" :class="(stats.followUps as unknown[]).length ? 'text-destructive' : ''">
            {{ (stats.followUps as unknown[]).length }}
          </p>
        </Card>
      </div>

      <!-- Stage breakdown -->
      <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card
          v-for="s in (stats.byStage as Array<{ stage: string, count: number }>)"
          :key="s.stage"
          class="p-4 text-center"
        >
          <StageBadge :stage="(s.stage as any)" class="mb-2" />
          <p class="text-2xl font-bold">{{ s.count }}</p>
        </Card>
      </div>

      <!-- Charts + follow ups -->
      <div class="grid lg:grid-cols-3 gap-6">
        <Card class="p-5 lg:col-span-1">
          <h2 class="font-semibold mb-4">By Stage</h2>
          <Bar :key="`bar-${colorMode.value}`" :data="stageChartData" :options="barOptions" />
        </Card>

        <Card class="p-5 lg:col-span-1">
          <h2 class="font-semibold mb-4">By Category</h2>
          <Pie :key="`pie-${colorMode.value}`" :data="categoryChartData" :options="pieOptions" />
        </Card>

        <Card class="p-5 lg:col-span-1">
          <h2 class="font-semibold mb-3 flex items-center gap-2">
            <Icon name="lucide:bell" class="h-4 w-4" />
            Follow-ups Due
          </h2>
          <div v-if="!(stats.followUps as unknown[]).length" class="text-sm text-muted-foreground py-4 text-center">
            No follow-ups due
          </div>
          <div v-else class="space-y-2">
            <NuxtLink
              v-for="f in (stats.followUps as Array<{ id: number, name: string, stage: string, follow_up_date: string, follow_up_note: string | null }>)"
              :key="f.id"
              :to="`/businesses/${f.id}`"
              class="block p-3 rounded-md border hover:bg-muted transition-colors"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-medium text-sm">{{ f.name }}</p>
                <span :class="['text-xs shrink-0', isOverdue(f.follow_up_date) ? 'text-destructive font-semibold' : 'text-muted-foreground']">
                  {{ formatDate(f.follow_up_date) }}
                </span>
              </div>
              <p v-if="f.follow_up_note" class="text-xs text-muted-foreground mt-0.5 line-clamp-1">{{ f.follow_up_note }}</p>
            </NuxtLink>
          </div>
        </Card>
      </div>

      <!-- Recent interactions -->
      <Card class="p-5">
        <h2 class="font-semibold mb-4">Recent Activity</h2>
        <div v-if="!(stats.recentInteractions as unknown[]).length" class="text-sm text-muted-foreground py-4 text-center">
          No recent activity
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="i in (stats.recentInteractions as Array<Record<string, unknown>>)"
            :key="i['id'] as number"
            class="flex items-start gap-3 text-sm"
          >
            <div class="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="lucide:message-square" class="h-4 w-4 text-muted-foreground" />
            </div>
            <div class="flex-1 min-w-0">
              <NuxtLink :to="`/businesses/${i['business_id']}`" class="font-medium hover:text-primary">
                {{ i['business_name'] }}
              </NuxtLink>
              <p class="text-muted-foreground">{{ i['title'] || i['type'] }}</p>
            </div>
            <span class="text-xs text-muted-foreground shrink-0">{{ useFormatting().formatRelative(i['created_at'] as string) }}</span>
          </div>
        </div>
      </Card>
    </template>
  </div>

  <!-- Complete Action Modal -->
  <Modal :open="showCompleteModal" title="Mark as Done" @close="showCompleteModal = false">
    <div class="p-6 space-y-4">
      <p v-if="completingAction" class="text-sm">
        Completing: <strong>{{ completingAction.step_title }}</strong>
        <span class="text-muted-foreground"> for {{ completingAction.business_name }}</span>
      </p>
      <FormField label="Completion Note">
        <Textarea v-model="completionNote" :rows="3" placeholder="Optional — what happened?" />
      </FormField>
      <div class="flex gap-3">
        <Button :loading="completing" @click="handleComplete">
          <Icon name="lucide:check-circle" class="h-4 w-4" />
          Mark Done
        </Button>
        <Button variant="outline" @click="showCompleteModal = false">Cancel</Button>
      </div>
    </div>
  </Modal>
</template>
