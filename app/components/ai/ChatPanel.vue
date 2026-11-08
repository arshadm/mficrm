<script setup lang="ts">
import { AI_STREAM_ERROR_MARKER, PROMPT_PLACEHOLDERS, type ChatMessage } from '~/shared/ai'
import { answerToNotesHtml, renderChatMarkdown, type CitableDocument } from '~/utils/chatMarkdown'

// Chat with Claude about one company (mficrm-bwv.2), after xivly's chat pane. Conversations are saved and shared
// with the team: the pane resumes the most recent one, earlier ones are in the history menu. Answers stream in as
// plain text and are shown as Markdown when complete, with document citations linked. Stop ends the answer
// (what arrived is kept). Saved prompts appear as suggestions and in the ✨ menu.
const props = defineProps<{
  business: { id: number, name: string, asking_price: number | null, trailing_12m_revenue: number | null, trailing_12m_profit: number | null, platform: string | null }
  active: boolean
}>()

interface ChatSummary { id: number, title: string, updated_at: string, created_by_username: string | null, message_count: number }
interface Chat { id: number, title: string, messages: ChatMessage[], updated_at: string, created_by_username: string | null }
interface Prompt { id: number, name: string, text: string }

const { configured, loadStatus } = useAi()
const { formatMoney, formatRelative } = useFormatting()
const { insertIntoNotes, chatFocus } = useCompanyPane()
const authStore = useAuthStore()

const chats = ref<ChatSummary[]>([])
const chat = ref<Chat | null>(null)
const prompts = ref<Prompt[]>([])
const docs = ref<CitableDocument[]>([])
const input = ref('')
const error = ref('')
const notice = ref('')
const loading = ref(true)

// The answer being streamed
const streaming = ref(false)
const streamText = ref('')
const pendingQuestion = ref('')
let abort: AbortController | null = null

const scroller = ref<HTMLElement | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)
const menu = ref<'prompts' | 'history' | null>(null)

const base = computed(() => `/api/businesses/${props.business.id}`)

async function loadList() {
  chats.value = await $fetch<ChatSummary[]>(`${base.value}/chats`)
}

async function openChat(id: number | null) {
  menu.value = null
  error.value = ''
  if (id === null) {
    chat.value = null
    return
  }
  chat.value = await $fetch<Chat>(`${base.value}/chats/${id}`)
  await nextTick()
  scrollToEnd(true)
}

async function init() {
  loading.value = true
  try {
    await loadStatus()
    const [, p, d] = await Promise.all([
      loadList(),
      $fetch<Prompt[]>('/api/ai/prompts'),
      $fetch<CitableDocument[]>(`${base.value}/documents`),
    ])
    prompts.value = p
    docs.value = d
    // Resume the most recent conversation
    if (chats.value[0]) await openChat(chats.value[0].id)
  } catch (e) {
    error.value = errorMessage(e, 'The conversations could not be loaded')
  } finally {
    loading.value = false
  }
}

function fill(text: string): string {
  const b = props.business
  const values: Record<(typeof PROMPT_PLACEHOLDERS)[number], string> = {
    company: b.name,
    asking_price: b.asking_price != null ? formatMoney(b.asking_price) : 'the asking price',
    revenue: b.trailing_12m_revenue != null ? formatMoney(b.trailing_12m_revenue) : 'the revenue',
    profit: b.trailing_12m_profit != null ? formatMoney(b.trailing_12m_profit) : 'the profit',
    platform: b.platform || 'the marketplace',
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => (values as Record<string, string>)[key] ?? whole)
}

// Auto-scroll unless the reader has scrolled up
let pinned = true
function onScroll() {
  const el = scroller.value
  if (el) pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 40
}
function scrollToEnd(force = false) {
  const el = scroller.value
  if (el && (force || pinned)) el.scrollTop = el.scrollHeight
}

async function ask(text?: string) {
  const question = (text ?? input.value).trim()
  if (!question || streaming.value) return
  error.value = ''
  menu.value = null
  input.value = ''
  pendingQuestion.value = question
  streamText.value = ''
  streaming.value = true
  pinned = true
  abort = new AbortController()
  await nextTick()
  scrollToEnd(true)

  let chatId = chat.value?.id ?? null
  try {
    const res = await fetch(`${base.value}/chats/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: question }),
      signal: abort.signal,
    })
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null) as { message?: string } | null
      throw new Error(body?.message || 'Claude could not answer')
    }
    chatId = Number(res.headers.get('x-chat-id')) || chatId
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      streamText.value += decoder.decode(value, { stream: true })
      await nextTick()
      scrollToEnd()
    }
    const marker = streamText.value.indexOf(AI_STREAM_ERROR_MARKER)
    if (marker >= 0) error.value = streamText.value.slice(marker + AI_STREAM_ERROR_MARKER.length)
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      error.value = (e as Error).message || 'Claude could not answer'
      // Nothing was saved if the request was refused outright: give the question back
      if (!streamText.value) input.value = question
    }
  } finally {
    abort = null
    // The server saved the conversation (question and answer, or what arrived before Stop); show the saved copy
    try {
      if (chatId) {
        await new Promise(r => setTimeout(r, 150))
        chat.value = await $fetch<Chat>(`${base.value}/chats/${chatId}`)
      }
      await loadList()
    } catch {}
    streaming.value = false
    streamText.value = ''
    pendingQuestion.value = ''
    await nextTick()
    scrollToEnd()
  }
}

function stop() {
  abort?.abort()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    void ask()
  }
}

async function removeChat(id: number) {
  if (!confirm('Delete this conversation for everyone?')) return
  await $fetch(`${base.value}/chats/${id}`, { method: 'DELETE' })
  if (chat.value?.id === id) chat.value = null
  await loadList()
}

async function saveAsPrompt() {
  menu.value = null
  const text = input.value.trim()
  if (!text) return
  const name = window.prompt('Name for this prompt', text.slice(0, 40))
  if (!name?.trim()) return
  try {
    prompts.value = await $fetch<Prompt[]>('/api/ai/prompts', {
      method: 'PUT',
      body: { prompts: [...prompts.value.map(p => ({ name: p.name, text: p.text })), { name: name.trim().slice(0, 60), text }] },
    })
    flash('Saved to the team’s prompts')
  } catch (e) {
    error.value = errorMessage(e, 'The prompt could not be saved')
  }
}

function usePrompt(p: Prompt) {
  menu.value = null
  void ask(fill(p.text))
}

let noticeTimer: ReturnType<typeof setTimeout> | null = null
function flash(text: string) {
  notice.value = text
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2500)
}

async function copy(md: string) {
  await navigator.clipboard.writeText(md)
  flash('Copied as Markdown')
}

function addToNotes(index: number) {
  const messages = chat.value?.messages ?? []
  const answer = messages[index]!
  const question = messages[index - 1]?.role === 'user' ? messages[index - 1]!.text : ''
  if (insertIntoNotes(answerToNotesHtml(question, answer.text, docs.value))) {
    flash('Added to the notes')
  } else {
    error.value = 'Open the notes first'
  }
}

// Teammates' new messages in the open conversation
async function poll() {
  if (!props.active || streaming.value || !chat.value || document.hidden) return
  try {
    const list = await $fetch<ChatSummary[]>(`${base.value}/chats`)
    chats.value = list
    const mine = list.find(c => c.id === chat.value?.id)
    if (mine && mine.updated_at !== chat.value.updated_at) chat.value = await $fetch<Chat>(`${base.value}/chats/${mine.id}`)
  } catch {}
}

let pollTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void init()
  pollTimer = setInterval(poll, 10000)
})
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
watch(chatFocus, () => nextTick(() => textarea.value?.focus()))
watch(() => props.active, (a) => {
  if (a) nextTick(() => textarea.value?.focus())
})
// Close menus on outside click
function onDocClick(e: MouseEvent) {
  if (menu.value && !(e.target as HTMLElement).closest('[data-chat-menu]')) menu.value = null
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

const messages = computed(() => chat.value?.messages ?? [])
// A teammate's question still being answered (on their side)
const othersPending = computed(() => {
  const last = messages.value.at(-1)
  return !streaming.value && last?.role === 'user' && Date.now() - new Date(last.at).getTime() < 3 * 60 * 1000
})
const suggestions = computed(() => prompts.value.slice(0, 4))
const rendered = (md: string) => renderChatMarkdown(md, docs.value)
const isMine = (m: ChatMessage) => m.user_id === authStore.user?.id
</script>

<template>
  <div class="flex flex-col h-full min-h-0" data-test="company-chat">
    <!-- Header -->
    <div class="flex items-center gap-1 border-b px-2 py-1.5 shrink-0">
      <span class="flex-1 min-w-0 truncate text-sm font-medium px-1" :title="chat?.title">{{ chat?.title || 'New conversation' }}</span>
      <div class="relative" data-chat-menu>
        <button class="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Saved prompts" aria-label="Saved prompts" data-test="chat-prompts" @click="menu = menu === 'prompts' ? null : 'prompts'">
          <Icon name="lucide:wand-sparkles" class="h-4 w-4" />
        </button>
        <div v-if="menu === 'prompts'" class="absolute right-0 top-full mt-1 z-20 w-72 rounded-md border bg-card shadow-lg py-1 text-sm max-h-80 overflow-y-auto">
          <button v-for="p in prompts" :key="p.id" class="w-full text-left px-3 py-1.5 hover:bg-muted" :disabled="streaming" @click="usePrompt(p)">
            <span class="block font-medium">{{ p.name }}</span>
            <span class="block text-xs text-muted-foreground truncate">{{ fill(p.text) }}</span>
          </button>
          <p v-if="!prompts.length" class="px-3 py-1.5 text-xs text-muted-foreground">No saved prompts yet.</p>
          <div class="border-t mt-1 pt-1">
            <button class="w-full text-left px-3 py-1.5 hover:bg-muted disabled:opacity-50" :disabled="!input.trim()" @click="saveAsPrompt">Save this question as a prompt…</button>
            <NuxtLink to="/settings/prompts" class="block px-3 py-1.5 hover:bg-muted">Edit prompts…</NuxtLink>
          </div>
        </div>
      </div>
      <button class="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="New conversation" aria-label="New conversation" data-test="chat-new" :disabled="streaming" @click="openChat(null)">
        <Icon name="lucide:square-pen" class="h-4 w-4" />
      </button>
      <div class="relative" data-chat-menu>
        <button class="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Earlier conversations" aria-label="Earlier conversations" data-test="chat-history" @click="menu = menu === 'history' ? null : 'history'">
          <Icon name="lucide:history" class="h-4 w-4" />
        </button>
        <div v-if="menu === 'history'" class="absolute right-0 top-full mt-1 z-20 w-80 rounded-md border bg-card shadow-lg py-1 text-sm max-h-96 overflow-y-auto" data-test="chat-history-list">
          <div v-for="c in chats" :key="c.id" :class="['group flex items-start gap-2 px-3 py-1.5 hover:bg-muted', c.id === chat?.id && 'bg-muted/60']">
            <button class="flex-1 min-w-0 text-left" :disabled="streaming" @click="openChat(c.id)">
              <span class="block truncate">{{ c.title }}</span>
              <span class="block text-xs text-muted-foreground">{{ formatRelative(c.updated_at) }}<template v-if="c.created_by_username"> · {{ c.created_by_username }}</template></span>
            </button>
            <button class="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive" aria-label="Delete conversation" @click="removeChat(c.id)">
              <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
            </button>
          </div>
          <p v-if="!chats.length" class="px-3 py-1.5 text-xs text-muted-foreground">No conversations yet.</p>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div ref="scroller" class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4" @scroll="onScroll">
      <div v-if="loading" class="flex justify-center py-10">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
      <div v-else-if="!configured" class="text-sm text-muted-foreground py-6 text-center">
        AI assistance isn't available right now. An administrator can check it under
        <NuxtLink to="/settings/claude" class="underline">Settings → Claude</NuxtLink>.
      </div>
      <template v-else>
        <div v-if="!messages.length && !streaming" class="space-y-3 py-2">
          <p class="text-sm text-muted-foreground">
            Ask Claude about {{ business.name }}. It reads the company's documents{{ docs.length ? ` (${docs.length})` : '' }}, its details and the team's notes.
            Conversations are shared with the team.
          </p>
          <div class="grid gap-2" data-test="chat-suggestions">
            <button
              v-for="p in suggestions"
              :key="p.id"
              class="text-left rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
              @click="ask(fill(p.text))"
            >
              <span class="font-medium block">{{ p.name }}</span>
              <span class="text-xs text-muted-foreground line-clamp-2">{{ fill(p.text) }}</span>
            </button>
          </div>
        </div>

        <template v-for="(m, i) in messages" :key="i">
          <div v-if="m.role === 'user'" class="ml-8">
            <p v-if="!isMine(m) && m.username" class="text-[11px] text-muted-foreground mb-0.5 text-right">{{ m.username }}</p>
            <div class="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words" data-test="chat-question">{{ m.text }}</div>
          </div>
          <div v-else class="group" data-test="chat-answer">
            <!-- eslint-disable-next-line vue/no-v-html -- marked output sanitised by DOMPurify (chatMarkdown.ts) -->
            <div v-if="m.text" class="chat-answer break-words" v-html="rendered(m.text)" />
            <p v-if="m.error" class="mt-1 text-xs text-muted-foreground italic">{{ m.error === 'Stopped' ? 'Stopped' : `Not finished: ${m.error}` }}</p>
            <div v-if="m.text" class="mt-1 flex gap-3 text-xs text-muted-foreground">
              <button class="hover:text-foreground flex items-center gap-1" @click="copy(m.text)"><Icon name="lucide:copy" class="h-3.5 w-3.5" /> Copy</button>
              <button class="hover:text-foreground flex items-center gap-1" data-test="chat-add-to-notes" @click="addToNotes(i)"><Icon name="lucide:notebook-pen" class="h-3.5 w-3.5" /> Add to notes</button>
            </div>
          </div>
        </template>

        <div v-if="othersPending" class="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" /> Claude is answering {{ messages.at(-1)?.username || 'a teammate' }}…
        </div>

        <template v-if="streaming">
          <div class="ml-8">
            <div class="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap break-words">{{ pendingQuestion }}</div>
          </div>
          <div data-test="chat-streaming">
            <div v-if="streamText" class="text-sm whitespace-pre-wrap break-words">{{ streamText.split(AI_STREAM_ERROR_MARKER)[0] }}</div>
            <p class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" /> {{ streamText ? 'Writing…' : 'Reading the documents…' }}
            </p>
          </div>
        </template>
      </template>
    </div>

    <!-- Input -->
    <div v-if="configured" class="border-t p-2 shrink-0 space-y-1.5">
      <p v-if="error" class="rounded-md border border-red-300 bg-red-100 px-2 py-1.5 text-xs text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300" data-test="chat-error">{{ error }}</p>
      <p v-if="notice" class="text-xs text-muted-foreground">{{ notice }}</p>
      <div class="flex items-end gap-2">
        <textarea
          ref="textarea"
          v-model="input"
          rows="2"
          maxlength="8000"
          placeholder="Ask about this company…"
          class="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          data-test="chat-input"
          :disabled="loading"
          @keydown="onKeydown"
        />
        <Button v-if="streaming" variant="outline" size="sm" data-test="chat-stop" @click="stop">
          <Icon name="lucide:square" class="h-4 w-4" /> Stop
        </Button>
        <Button v-else size="sm" data-test="chat-send" :disabled="!input.trim() || loading || othersPending" @click="ask()">
          <Icon name="lucide:send" class="h-4 w-4" /> Ask
        </Button>
      </div>
      <p class="text-[11px] text-muted-foreground">Enter to send, Shift+Enter for a new line</p>
    </div>
  </div>
</template>
