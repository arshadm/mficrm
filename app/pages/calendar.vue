<script setup lang="ts">
import type { CalendarEntry, CalendarData } from '~/shared/types'
import { CATEGORY_LABELS } from '~/shared/types'

const { getStatus } = useNextStepStatus()
const { formatDate } = useFormatting()

type ViewMode = 'week' | 'month'
const viewMode = ref<ViewMode>('week')
const currentDate = ref(new Date())

// Date range computation
const dateRange = computed(() => {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'week') {
    // Start of week (Monday)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const start = new Date(d.setDate(diff))
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start, end }
  } else {
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return { start, end }
  }
})

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

const requestFetch = useRequestFetch() // forwards the session cookie during server rendering
const { data: calendarData, refresh, pending } = await useAsyncData(
  'calendar',
  () => requestFetch<CalendarData>('/api/calendar', {
    query: { from: toDateStr(dateRange.value.start), to: toDateStr(dateRange.value.end) },
  }),
  { watch: [dateRange] }
)

function navigate(dir: -1 | 1) {
  const d = new Date(currentDate.value)
  if (viewMode.value === 'week') d.setDate(d.getDate() + dir * 7)
  else d.setMonth(d.getMonth() + dir)
  currentDate.value = d
}

function goToday() { currentDate.value = new Date() }

// Generate days array for current view
const days = computed(() => {
  const result: Date[] = []
  const { start, end } = dateRange.value
  const cur = new Date(start)
  while (cur <= end) {
    result.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return result
})

// For month view: fill to complete weeks
const monthGridDays = computed(() => {
  if (viewMode.value !== 'month') return []
  const { start } = dateRange.value
  const result: (Date | null)[] = []
  // Fill leading nulls
  const firstDow = start.getDay()
  const leading = firstDow === 0 ? 6 : firstDow - 1
  for (let i = 0; i < leading; i++) result.push(null)
  for (const d of days.value) result.push(d)
  // Trailing nulls to complete last week
  while (result.length % 7 !== 0) result.push(null)
  return result
})

function getEntriesForDate(date: Date): CalendarEntry[] {
  if (!calendarData.value) return []
  const key = toDateStr(date)
  return calendarData.value[key] || []
}

function isToday(date: Date): boolean {
  return toDateStr(date) === toDateStr(new Date())
}

function isPast(date: Date): boolean {
  return date < new Date(toDateStr(new Date()))
}

// Category colors
const categoryBadgeColors: Record<string, string> = {
  fba: 'bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300',
  saas: 'bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300',
  ios: 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300',
  android: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300',
  content: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300',
  ecommerce: 'bg-pink-100 dark:bg-pink-500/15 text-pink-800 dark:text-pink-300',
  agency: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300',
  marketplace: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300',
  newsletter: 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300',
  other: 'bg-gray-100 dark:bg-muted text-gray-700 dark:text-muted-foreground',
}

// Week summary
const weekSummary = computed(() => {
  if (!calendarData.value) return { total: 0, overdue: 0 }
  let total = 0; let overdue = 0
  for (const entries of Object.values(calendarData.value)) {
    for (const e of entries) {
      total++
      if (e.is_overdue) overdue++
    }
  }
  return { total, overdue }
})

// Header title
const headerTitle = computed(() => {
  const { start, end } = dateRange.value
  if (viewMode.value === 'week') {
    return `${start.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="p-6 pb-4 border-b shrink-0">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-2xl font-bold">Action Calendar</h1>
          <p class="text-muted-foreground text-sm">{{ headerTitle }}</p>
        </div>
        <div class="flex items-center gap-2">
          <!-- View toggle -->
          <div class="flex rounded-md border overflow-hidden">
            <button
              v-for="v in [{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]"
              :key="v.id"
              :class="['px-3 py-1.5 text-sm font-medium transition-colors', viewMode === v.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted']"
              @click="viewMode = v.id as ViewMode"
            >
              {{ v.label }}
            </button>
          </div>
          <!-- Navigation -->
          <Button variant="outline" size="icon" class="h-9 w-9" @click="navigate(-1)">
            <Icon name="lucide:chevron-left" class="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" @click="goToday">Today</Button>
          <Button variant="outline" size="icon" class="h-9 w-9" @click="navigate(1)">
            <Icon name="lucide:chevron-right" class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <div v-if="pending" class="flex items-center justify-center py-20">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- WEEK VIEW -->
    <div v-else-if="viewMode === 'week'" class="flex flex-1 overflow-hidden">
      <div class="flex-1 overflow-x-auto p-4">
        <div class="grid grid-cols-7 gap-2 min-w-[700px]">
          <!-- Day headers -->
          <div
            v-for="d in days"
            :key="toDateStr(d)"
            :class="[
              'text-center py-2 rounded-t-lg text-sm font-medium',
              isToday(d) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            ]"
          >
            <div>{{ d.toLocaleDateString('en-GB', { weekday: 'short' }) }}</div>
            <div :class="['text-lg font-bold', isToday(d) ? '' : 'text-foreground']">{{ d.getDate() }}</div>
          </div>

          <!-- Day cells -->
          <div
            v-for="d in days"
            :key="`cell-${toDateStr(d)}`"
            :class="[
              'min-h-40 rounded-b-lg border p-2 space-y-1.5',
              isToday(d) ? 'bg-primary/5 border-primary/30' : 'bg-card',
              isPast(d) && !isToday(d) ? 'opacity-70' : ''
            ]"
          >
            <template v-if="getEntriesForDate(d).length">
              <NuxtLink
                v-for="entry in getEntriesForDate(d)"
                :key="entry.step_id"
                :to="`/businesses/${entry.business_id}?tab=next-steps`"
                :class="[
                  'block rounded-md p-2 border text-xs hover:shadow-sm transition-shadow',
                  entry.is_overdue ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/40' : 'bg-background border-border'
                ]"
              >
                <div class="flex items-center gap-1 mb-0.5">
                  <span :class="['text-xs px-1.5 py-0.5 rounded-full font-medium', categoryBadgeColors[entry.business_category] || categoryBadgeColors.other]">
                    {{ entry.business_category }}
                  </span>
                  <Icon v-if="entry.is_overdue" name="lucide:alert-circle" class="h-3 w-3 text-red-500" />
                </div>
                <p class="font-semibold truncate">{{ entry.business_name }}</p>
                <p class="text-muted-foreground truncate">{{ entry.step_title }}</p>
              </NuxtLink>
            </template>
            <div v-else class="flex items-center justify-center h-full text-muted-foreground/40">
              <span class="text-lg">☀️</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Week summary sidebar -->
      <div class="w-56 border-l p-4 shrink-0 space-y-4">
        <h3 class="font-semibold text-sm">This Week</h3>
        <div class="space-y-2">
          <Card class="p-3">
            <p class="text-xs text-muted-foreground">Total Actions</p>
            <p class="text-2xl font-bold">{{ weekSummary.total }}</p>
          </Card>
          <Card class="p-3">
            <p class="text-xs text-muted-foreground">Overdue</p>
            <p :class="['text-2xl font-bold', weekSummary.overdue > 0 ? 'text-destructive' : '']">{{ weekSummary.overdue }}</p>
          </Card>
        </div>
      </div>
    </div>

    <!-- MONTH VIEW -->
    <div v-else class="flex-1 overflow-auto p-4">
      <!-- Day-of-week headers -->
      <div class="grid grid-cols-7 gap-1 mb-1">
        <div
          v-for="dow in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']"
          :key="dow"
          class="text-center text-xs font-medium text-muted-foreground py-2"
        >
          {{ dow }}
        </div>
      </div>

      <!-- Grid -->
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="(d, idx) in monthGridDays"
          :key="idx"
          :class="[
            'min-h-24 rounded-lg border p-1.5',
            !d ? 'bg-muted/20 border-transparent' : isToday(d) ? 'bg-primary/5 border-primary/30' : 'bg-card',
          ]"
        >
          <template v-if="d">
            <div :class="['text-xs font-medium mb-1', isToday(d) ? 'text-primary font-bold' : 'text-muted-foreground']">
              {{ d.getDate() }}
            </div>
            <template v-if="getEntriesForDate(d).length <= 3">
              <NuxtLink
                v-for="entry in getEntriesForDate(d)"
                :key="entry.step_id"
                :to="`/businesses/${entry.business_id}?tab=next-steps`"
                :class="[
                  'block text-xs truncate rounded px-1 py-0.5 mb-0.5 hover:opacity-80',
                  entry.is_overdue ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300' : categoryBadgeColors[entry.business_category] || 'bg-gray-100 dark:bg-muted'
                ]"
                :title="entry.business_name + ': ' + entry.step_title"
              >
                {{ entry.business_name }}
              </NuxtLink>
            </template>
            <template v-else>
              <NuxtLink
                v-for="entry in getEntriesForDate(d).slice(0, 2)"
                :key="entry.step_id"
                :to="`/businesses/${entry.business_id}?tab=next-steps`"
                :class="['block text-xs truncate rounded px-1 py-0.5 mb-0.5 hover:opacity-80', categoryBadgeColors[entry.business_category] || 'bg-gray-100 dark:bg-muted']"
              >
                {{ entry.business_name }}
              </NuxtLink>
              <span class="text-xs text-muted-foreground font-medium">+{{ getEntriesForDate(d).length - 2 }} more</span>
            </template>
            <div v-if="!getEntriesForDate(d).length" class="text-muted-foreground/30 text-center text-sm">☀️</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
