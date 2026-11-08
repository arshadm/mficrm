<script setup lang="ts">
import { PROMPT_PLACEHOLDERS, PromptsSchema } from '~/shared/ai'

// Settings → Chat prompts (mficrm-bwv.3): the team's saved questions for the company chat. The first four show as
// suggestions in an empty conversation; all of them are in the chat's ✨ menu. Saved 500 ms after a change.
interface Prompt { name: string, text: string }

const requestFetch = useRequestFetch()
const { data } = await useAsyncData('ai-prompts', () => requestFetch<(Prompt & { id: number })[]>('/api/ai/prompts'))
const prompts = ref<Prompt[]>((data.value ?? []).map(p => ({ name: p.name, text: p.text })))
const state = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const error = ref('')

let timer: ReturnType<typeof setTimeout> | null = null
watch(prompts, () => {
  const check = PromptsSchema.safeParse({ prompts: prompts.value })
  if (!check.success) {
    state.value = 'error'
    error.value = check.error.issues[0]?.message || 'Check the prompts'
    return
  }
  error.value = ''
  state.value = 'saving'
  if (timer) clearTimeout(timer)
  timer = setTimeout(save, 500)
}, { deep: true })

async function save() {
  try {
    await $fetch('/api/ai/prompts', { method: 'PUT', body: { prompts: prompts.value } })
    state.value = 'saved'
  } catch (e) {
    state.value = 'error'
    error.value = errorMessage(e, 'The prompts could not be saved')
  }
}

function add() {
  prompts.value.push({ name: 'New prompt', text: '' })
}
function move(i: number, by: number) {
  const j = i + by
  if (j < 0 || j >= prompts.value.length) return
  const list = [...prompts.value]
  ;[list[i], list[j]] = [list[j]!, list[i]!]
  prompts.value = list
}
</script>

<template>
  <div class="p-6 max-w-2xl space-y-4">
    <SettingsNav />
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Chat prompts</h1>
        <p class="text-sm text-muted-foreground mt-1">
          Saved questions for the company chat, shared with the team. The first four appear as suggestions in a new
          conversation. Placeholders filled in from the company:
          <code v-for="p in PROMPT_PLACEHOLDERS" :key="p" class="text-xs bg-muted rounded px-1 mr-1" v-text="`{{${p}}}`" />
        </p>
      </div>
      <span class="text-xs text-muted-foreground whitespace-nowrap pt-1" data-test="prompts-state">
        <template v-if="state === 'saving'">Saving…</template>
        <template v-else-if="state === 'saved'">Saved</template>
        <span v-else-if="state === 'error'" class="text-destructive">{{ error }}</span>
      </span>
    </div>

    <Card v-for="(p, i) in prompts" :key="i" class="p-3 space-y-2" data-test="prompt-row">
      <div class="flex items-center gap-2">
        <Input v-model="p.name" placeholder="Name" class="flex-1" maxlength="60" />
        <button class="p-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-30" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)"><Icon name="lucide:arrow-up" class="h-4 w-4" /></button>
        <button class="p-1.5 rounded text-muted-foreground hover:bg-muted disabled:opacity-30" :disabled="i === prompts.length - 1" aria-label="Move down" @click="move(i, 1)"><Icon name="lucide:arrow-down" class="h-4 w-4" /></button>
        <button class="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Delete prompt" data-test="prompt-delete" @click="prompts.splice(i, 1)"><Icon name="lucide:trash-2" class="h-4 w-4" /></button>
      </div>
      <Textarea v-model="p.text" :rows="2" placeholder="The question to ask Claude" />
    </Card>

    <Button variant="outline" data-test="prompt-add" @click="add">
      <Icon name="lucide:plus" class="h-4 w-4" /> Add prompt
    </Button>
  </div>
</template>
