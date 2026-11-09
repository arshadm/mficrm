<script setup lang="ts">
import type { AiSummary } from '~/shared/ai'

// AI summary of a company's documents (mficrm-b6g.5), stored on the business and refreshed on request
const props = defineProps<{ businessId: number, documentCount: number }>()

const { configured, loadStatus } = useAi()
const { formatDateTime } = useFormatting()
const summary = ref<AiSummary | null>(null)
const madeAt = ref<string | null>(null)
const skipped = ref<{ name: string, reason: string }[]>([])
const loading = ref(true)
const generating = ref(false)
const error = ref('')

onMounted(async () => {
  await loadStatus()
  try {
    const res = await $fetch<{ summary: AiSummary | null, ai_summary_at: string | null }>(`/api/businesses/${props.businessId}/ai/summary`)
    summary.value = res.summary
    madeAt.value = res.ai_summary_at
  } finally {
    loading.value = false
  }
})

// The proxy in front of the app (kamal-proxy, then Cloudflare at 100 s) can give up on a long request while the
// server carries on and saves the summary. Then wait for the saved one instead of reporting a failure.
const GATEWAY_TIMEOUTS = [502, 504, 524]
const WAIT_FOR_SAVED_MS = 5 * 60 * 1000

async function waitForSaved(startedAt: number): Promise<boolean> {
  while (Date.now() - startedAt < WAIT_FOR_SAVED_MS) {
    await new Promise(r => setTimeout(r, 5000))
    try {
      const res = await $fetch<{ summary: AiSummary | null, ai_summary_at: string | null }>(`/api/businesses/${props.businessId}/ai/summary`)
      if (res.summary && res.ai_summary_at && new Date(res.ai_summary_at).getTime() >= startedAt - 5000) {
        summary.value = res.summary
        madeAt.value = res.ai_summary_at
        skipped.value = []
        return true
      }
    } catch {}
  }
  return false
}

async function generate() {
  error.value = ''
  generating.value = true
  const startedAt = Date.now()
  try {
    const res = await $fetch<{ summary: AiSummary, ai_summary_at: string, skipped: { name: string, reason: string }[] }>(
      `/api/businesses/${props.businessId}/ai/summary`, { method: 'POST', timeout: WAIT_FOR_SAVED_MS })
    summary.value = res.summary
    madeAt.value = res.ai_summary_at
    skipped.value = res.skipped
  } catch (e) {
    const status = (e as { statusCode?: number, status?: number })?.statusCode ?? (e as { status?: number })?.status
    if (status && GATEWAY_TIMEOUTS.includes(status)) {
      if (!(await waitForSaved(startedAt))) error.value = 'Claude is taking too long. Try again in a few minutes.'
    } else {
      error.value = errorMessage(e, 'The summary could not be made')
    }
  } finally {
    generating.value = false
  }
}

const lists = computed(() => summary.value
  ? [
      { title: 'Strengths', items: summary.value.strengths, icon: 'lucide:thumbs-up', tone: 'text-green-700 dark:text-green-300' },
      { title: 'Risks and red flags', items: summary.value.risks, icon: 'lucide:alert-triangle', tone: 'text-amber-700 dark:text-amber-300' },
      { title: 'Questions for the seller', items: summary.value.questions_for_seller, icon: 'lucide:message-circle-question', tone: 'text-blue-700 dark:text-blue-300' },
      { title: 'Missing or inconsistent information', items: summary.value.data_gaps, icon: 'lucide:file-question', tone: 'text-muted-foreground' },
    ].filter(l => l.items.length)
  : [])
</script>

<template>
  <div class="space-y-3" data-test="ai-summary">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold flex items-center gap-1.5">
        <Icon name="lucide:sparkles" class="h-4 w-4 text-primary" />
        AI summary
      </h2>
      <Button
        v-if="configured"
        size="sm"
        :variant="summary ? 'outline' : 'default'"
        :loading="generating"
        :disabled="!documentCount"
        data-test="ai-summarise"
        @click="generate"
      >
        {{ summary ? 'Refresh' : 'Summarise documents' }}
      </Button>
    </div>

    <p v-if="!configured && !loading" class="text-sm text-muted-foreground">
      AI assistance isn't available right now. An administrator can check it under <NuxtLink to="/settings/claude" class="underline">Settings → Claude</NuxtLink>.
    </p>
    <p v-else-if="!documentCount && !summary" class="text-sm text-muted-foreground">Add documents above, then Claude can summarise them.</p>
    <p v-if="generating" class="text-sm text-muted-foreground flex items-center gap-2">
      <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin" /> Claude is reading the documents. This can take a minute.
    </p>
    <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
    <p v-if="skipped.length" class="text-xs text-amber-700 dark:text-amber-300">
      Not included: {{ skipped.map(s => `${s.name} (${s.reason})`).join(', ') }}
    </p>

    <Card v-if="summary" class="p-5 space-y-5 text-sm">
      <p class="leading-relaxed">{{ summary.overview }}</p>

      <div v-if="summary.financials.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <tbody class="divide-y">
            <tr v-for="(f, i) in summary.financials" :key="i">
              <td class="py-1.5 pr-4 text-muted-foreground whitespace-nowrap align-top">{{ f.label }}</td>
              <td class="py-1.5 pr-4 font-medium whitespace-nowrap align-top">{{ f.value }}</td>
              <td class="py-1.5 text-xs text-muted-foreground align-top">{{ f.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-for="list in lists" :key="list.title" class="space-y-1.5">
        <h3 class="font-medium flex items-center gap-1.5" :class="list.tone">
          <Icon :name="list.icon" class="h-4 w-4" />
          {{ list.title }}
        </h3>
        <ul class="list-disc pl-5 space-y-1">
          <li v-for="(item, i) in list.items" :key="i">{{ item }}</li>
        </ul>
      </div>

      <p class="text-xs text-muted-foreground border-t pt-3">
        Made by Claude from the documents {{ madeAt ? formatDateTime(madeAt) : '' }}. Check important figures against the source.
      </p>
    </Card>
  </div>
</template>
