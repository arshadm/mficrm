<script setup lang="ts">
import type { NextStep } from '~/shared/types'

interface Props {
  businessId: string | number
}
const props = defineProps<Props>()

const idRef = computed(() => props.businessId)
const {
  data, loading, saving,
  fetchNextSteps, createNextStep, updateNextStep,
  completeStep, skipStep,
  addSubtask, toggleSubtask, deleteSubtask, deleteStep,
} = useNextSteps(idRef)

const { getStatus } = useNextStepStatus()
const { formatDate, formatDateTime } = useFormatting()

onMounted(fetchNextSteps)

// ---- Create / Edit primary step ----
const showCreateForm = ref(false)
const showEditForm = ref(false)
const editForm = reactive({ title: '', notes: '', due_date: '' })
const createForm = reactive({ title: '', notes: '', due_date: '' })
const createError = ref('')

async function handleCreate() {
  createError.value = ''
  if (!createForm.title.trim() || !createForm.due_date) {
    createError.value = 'Title and due date are required'
    return
  }
  try {
    await createNextStep({ title: createForm.title, notes: createForm.notes || null, due_date: createForm.due_date })
    showCreateForm.value = false
    Object.assign(createForm, { title: '', notes: '', due_date: '' })
  } catch (e: unknown) {
    createError.value = (e as { data?: { message?: string } })?.data?.message || 'Failed to create next step'
  }
}

function openEdit() {
  if (!data.value.primary) return
  Object.assign(editForm, {
    title: data.value.primary.title,
    notes: data.value.primary.notes ?? '',
    due_date: data.value.primary.due_date,
  })
  showEditForm.value = true
}

async function handleEdit() {
  if (!data.value.primary) return
  await updateNextStep(data.value.primary.id, { title: editForm.title, notes: editForm.notes || null, due_date: editForm.due_date })
  showEditForm.value = false
}

// ---- Complete / Skip ----
const showCompleteModal = ref(false)
const showSkipModal = ref(false)
const completionNote = ref('')
const showNewStepPrompt = ref(false)

async function handleComplete() {
  if (!data.value.primary) return
  await completeStep(data.value.primary.id, completionNote.value || undefined)
  showCompleteModal.value = false
  completionNote.value = ''
  showNewStepPrompt.value = true
}

async function handleSkip() {
  if (!data.value.primary) return
  await skipStep(data.value.primary.id, completionNote.value || undefined)
  showSkipModal.value = false
  completionNote.value = ''
  showNewStepPrompt.value = false
}

// ---- Subtasks ----
const newSubtaskTitle = ref('')
const newSubtaskDueDate = ref('')

async function handleAddSubtask() {
  if (!newSubtaskTitle.value.trim() || !data.value.primary) return
  await addSubtask(data.value.primary.id, {
    title: newSubtaskTitle.value,
    due_date: newSubtaskDueDate.value || null,
  })
  newSubtaskTitle.value = ''
  newSubtaskDueDate.value = ''
}

// ---- History ----
const showHistory = ref(false)
</script>

<template>
  <div class="space-y-6 max-w-2xl">
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- PRIMARY NEXT STEP -->
      <div>
        <!-- Active step card -->
        <template v-if="data.primary && !showEditForm">
          <Card :class="['p-5 border-2', getStatus(data.primary.due_date, data.primary.status).isOverdue ? 'border-red-300' : 'border-primary/30']">
            <div class="flex items-start justify-between gap-3 mb-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary Next Step</span>
                  <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', getStatus(data.primary.due_date, data.primary.status).badgeClass]">
                    {{ getStatus(data.primary.due_date, data.primary.status).label }}
                  </span>
                </div>
                <h3 class="text-lg font-semibold leading-snug">{{ data.primary.title }}</h3>
                <p v-if="data.primary.notes" class="text-sm text-muted-foreground mt-1">{{ data.primary.notes }}</p>
              </div>
              <Button variant="ghost" size="icon" class="shrink-0" @click="openEdit">
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <Button size="sm" @click="showCompleteModal = true" :loading="saving">
                <Icon name="lucide:check-circle" class="h-4 w-4" />
                Mark Done
              </Button>
              <Button variant="outline" size="sm" @click="showSkipModal = true">
                <Icon name="lucide:skip-forward" class="h-4 w-4" />
                Skip
              </Button>
              <Button variant="ghost" size="sm" class="text-muted-foreground" @click="deleteStep(data.primary.id)">
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </div>
          </Card>

          <!-- New step prompt shown after completing/skipping -->
          <Card v-if="showNewStepPrompt" class="p-4 mt-3 bg-primary/5 border-primary/20">
            <p class="text-sm font-medium mb-3">Set a new next step?</p>
            <div class="flex gap-2">
              <Button size="sm" @click="showNewStepPrompt = false; showCreateForm = true">
                <Icon name="lucide:plus" class="h-4 w-4" />
                Add Next Step
              </Button>
              <Button variant="outline" size="sm" @click="showNewStepPrompt = false">Later</Button>
            </div>
          </Card>
        </template>

        <!-- Inline edit form -->
        <Card v-else-if="showEditForm" class="p-5 border-2 border-primary/30">
          <h3 class="font-medium mb-3">Edit Next Step</h3>
          <div class="space-y-3">
            <FormField label="Title" required>
              <Input v-model="editForm.title" placeholder="What needs to happen?" />
            </FormField>
            <FormField label="Due Date" required>
              <Input v-model="editForm.due_date" type="date" />
            </FormField>
            <FormField label="Notes">
              <Textarea v-model="editForm.notes" :rows="2" placeholder="Context or reason..." />
            </FormField>
            <div class="flex gap-2">
              <Button size="sm" @click="handleEdit">Save</Button>
              <Button variant="outline" size="sm" @click="showEditForm = false">Cancel</Button>
            </div>
          </div>
        </Card>

        <!-- Empty state: no active step -->
        <template v-else-if="!data.primary && !showCreateForm">
          <Card class="p-8 text-center border-2 border-dashed">
            <Icon name="lucide:target" class="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 class="font-semibold text-lg mb-1">No next step set</h3>
            <p class="text-sm text-muted-foreground mb-4">What should happen next with this business?</p>
            <Button @click="showCreateForm = true; showNewStepPrompt = false">
              <Icon name="lucide:plus" class="h-4 w-4" />
              Set Next Step
            </Button>
          </Card>
        </template>

        <!-- Create form -->
        <Card v-if="showCreateForm" class="p-5 border-2 border-primary/30 mt-3">
          <h3 class="font-medium mb-3">New Next Step</h3>
          <div class="space-y-3">
            <p v-if="createError" class="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{{ createError }}</p>
            <FormField label="Title" required>
              <Input v-model="createForm.title" placeholder="What needs to happen?" />
            </FormField>
            <FormField label="Due Date" required>
              <Input v-model="createForm.due_date" type="date" />
            </FormField>
            <FormField label="Notes">
              <Textarea v-model="createForm.notes" :rows="2" placeholder="Context or reason..." />
            </FormField>
            <div class="flex gap-2">
              <Button :loading="saving" @click="handleCreate">Create</Button>
              <Button variant="outline" @click="showCreateForm = false">Cancel</Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- SUB-TASKS (only if active primary step) -->
      <div v-if="data.primary">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-medium text-sm text-muted-foreground uppercase tracking-wide">Sub-tasks</h3>
          <span class="text-xs text-muted-foreground">{{ data.subtasks.filter(s => s.status === 'done').length }}/{{ data.subtasks.length }} done</span>
        </div>
        <Card class="overflow-hidden">
          <div class="divide-y">
            <div
              v-for="sub in data.subtasks"
              :key="sub.id"
              class="flex items-center gap-3 px-4 py-2.5"
            >
              <input
                type="checkbox"
                :checked="sub.status === 'done'"
                class="rounded shrink-0"
                @change="toggleSubtask(sub.id, sub.status !== 'done')"
              />
              <span :class="['flex-1 text-sm', sub.status === 'done' ? 'line-through text-muted-foreground' : '']">
                {{ sub.title }}
              </span>
              <span v-if="sub.due_date" class="text-xs text-muted-foreground">{{ formatDate(sub.due_date) }}</span>
              <button class="text-muted-foreground hover:text-destructive" @click="deleteSubtask(sub.id)">
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </button>
            </div>

            <!-- Add subtask row -->
            <div class="flex items-center gap-2 px-4 py-2.5 bg-muted/20">
              <Icon name="lucide:plus" class="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                v-model="newSubtaskTitle"
                type="text"
                placeholder="Add sub-task..."
                class="flex-1 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
                @keydown.enter="handleAddSubtask"
              />
              <Input
                v-model="newSubtaskDueDate"
                type="date"
                class="w-36 h-7 text-xs"
              />
              <Button v-if="newSubtaskTitle" size="sm" variant="outline" class="h-7 text-xs" @click="handleAddSubtask">Add</Button>
            </div>
          </div>
        </Card>
      </div>

      <!-- HISTORY -->
      <div>
        <button
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          @click="showHistory = !showHistory"
        >
          <Icon :name="showHistory ? 'lucide:chevron-up' : 'lucide:chevron-down'" class="h-4 w-4" />
          {{ showHistory ? 'Hide history' : `Show history — ${data.history.length} completed step${data.history.length !== 1 ? 's' : ''}` }}
        </button>

        <div v-if="showHistory" class="mt-3">
          <div v-if="!data.history.length" class="text-sm text-muted-foreground py-4 text-center">No history yet</div>
          <Card v-else class="overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b bg-muted/30">
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Title</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Due</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Note</th>
                  <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Completed</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in data.history" :key="h.id" class="border-b last:border-0">
                  <td class="px-4 py-2 font-medium">{{ h.title }}</td>
                  <td class="px-4 py-2 text-muted-foreground">{{ formatDate(h.due_date) }}</td>
                  <td class="px-4 py-2">
                    <span :class="['text-xs px-2 py-0.5 rounded-full', h.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600']">
                      {{ h.status }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-muted-foreground text-xs">{{ h.completion_note || '—' }}</td>
                  <td class="px-4 py-2 text-muted-foreground text-xs">
                    {{ h.completed_by_username ? `${h.completed_by_username} · ` : '' }}{{ formatDate(h.completed_at) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </template>

    <!-- MARK DONE MODAL -->
    <Modal :open="showCompleteModal" title="Mark as Done" @close="showCompleteModal = false">
      <div class="p-6 space-y-4">
        <p class="text-sm text-muted-foreground">Add an optional note about the outcome.</p>
        <FormField label="Completion Note">
          <Textarea v-model="completionNote" :rows="3" placeholder="What happened? Any outcome to note?" />
        </FormField>
        <div class="flex gap-3">
          <Button :loading="saving" @click="handleComplete">
            <Icon name="lucide:check-circle" class="h-4 w-4" />
            Mark Done
          </Button>
          <Button variant="outline" @click="showCompleteModal = false">Cancel</Button>
        </div>
      </div>
    </Modal>

    <!-- SKIP MODAL -->
    <Modal :open="showSkipModal" title="Skip this Step" @close="showSkipModal = false">
      <div class="p-6 space-y-4">
        <p class="text-sm text-muted-foreground">Add an optional note about why you're skipping.</p>
        <FormField label="Skip Reason">
          <Textarea v-model="completionNote" :rows="3" placeholder="Why are you skipping this step?" />
        </FormField>
        <div class="flex gap-3">
          <Button variant="outline" :loading="saving" @click="handleSkip">
            <Icon name="lucide:skip-forward" class="h-4 w-4" />
            Skip Step
          </Button>
          <Button variant="outline" @click="showSkipModal = false">Cancel</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
