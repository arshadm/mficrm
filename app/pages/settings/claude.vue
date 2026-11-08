<script setup lang="ts">
// Settings → Claude: whether the server's Claude CLI is installed and signed in, and how to sign it in
interface Status {
  configured: boolean
  model: string
  reason: 'ok' | 'not_installed' | 'signed_out' | 'error' | 'unknown'
  message?: string | null
  checked_at?: string | null
  login_command?: string
}

const authStore = useAuthStore()
const { formatDateTime } = useFormatting()
const { status: aiStatus } = useAi()
const requestFetch = useRequestFetch()

const { data: status, status: fetchState } = await useAsyncData('claude-status', () => requestFetch<Status>('/api/ai/status'))
const checking = ref(false)
const copied = ref(false)

async function checkNow() {
  checking.value = true
  try {
    status.value = await $fetch<Status>('/api/ai/status', { query: { refresh: '1' } })
    aiStatus.value = { configured: status.value.configured, model: status.value.model }
  } finally {
    checking.value = false
  }
}

async function copyCommand() {
  if (!status.value?.login_command) return
  await navigator.clipboard.writeText(status.value.login_command)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

const label = computed(() => ({
  ok: 'Signed in and working',
  signed_out: 'Not signed in',
  not_installed: 'Claude CLI not installed',
  error: 'Could not check',
  unknown: 'Not checked yet',
}[status.value?.reason ?? 'unknown']))
</script>

<template>
  <div class="p-6 max-w-2xl space-y-4">
    <SettingsNav />
    <div>
      <h1 class="text-2xl font-bold">Claude</h1>
      <p class="text-sm text-muted-foreground mt-1">
        The AI features (prefill from documents, summaries, company chat and form drafting) run the Claude Code CLI
        on the server, signed in with the team's Claude subscription.
      </p>
    </div>

    <Card class="p-4 space-y-3" data-test="claude-status">
      <div class="flex items-center gap-3">
        <span
          :class="['h-2.5 w-2.5 rounded-full shrink-0', status?.reason === 'ok' ? 'bg-green-500' : status?.reason === 'unknown' ? 'bg-muted-foreground' : 'bg-red-500']"
        />
        <div class="flex-1 min-w-0">
          <p class="font-medium">{{ fetchState === 'pending' ? 'Checking…' : label }}</p>
          <p class="text-xs text-muted-foreground">
            Model {{ status?.model }}<template v-if="status?.checked_at"> · checked {{ formatDateTime(status.checked_at) }}</template>
            <template v-if="status?.message && status.reason !== 'ok'"> · {{ status.message }}</template>
          </p>
        </div>
        <Button variant="outline" size="sm" :disabled="checking" data-test="claude-check" @click="checkNow">
          <Icon :name="checking ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="['h-4 w-4', checking && 'animate-spin']" />
          Check now
        </Button>
      </div>
    </Card>

    <Card v-if="authStore.user?.role === 'admin' && status?.login_command && status.reason !== 'ok'" class="p-4 space-y-2 text-sm">
      <p class="font-medium">Signing in</p>
      <p class="text-muted-foreground">
        Run this on your computer in the project folder, open the link it prints on any device, sign in to the
        team's Claude account and paste the code back. The login is kept on the server's data volume, so it survives
        deploys.
      </p>
      <div class="flex items-center gap-2">
        <code class="flex-1 min-w-0 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1.5 font-mono text-xs" data-test="claude-login-command">{{ status.login_command }}</code>
        <Button variant="outline" size="sm" @click="copyCommand">
          <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" class="h-4 w-4" />
        </Button>
      </div>
      <p class="text-muted-foreground">Then press <strong>Check now</strong>.</p>
    </Card>
  </div>
</template>
