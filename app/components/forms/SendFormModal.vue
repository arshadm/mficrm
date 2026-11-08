<script setup lang="ts">
import { FORM_LINK_DEFAULT_DAYS, FORM_LINK_MAX_DAYS } from '~/shared/schemas'

// Creates a form link (optionally emailing it). The link URL is only available in the create response, so it's
// shown here once, with a copy button.
const props = defineProps<{ open: boolean, businessId?: number | null, formId?: number | null }>()
const emit = defineEmits<{ close: [], created: [] }>()

interface FormOption { id: number, name: string, latest_version: number | null, status: string }

const forms = ref<FormOption[]>([])
const loadingForms = ref(false)
const form = reactive({
  form_id: null as number | null,
  recipient_name: '',
  recipient_email: '',
  expires_in_days: FORM_LINK_DEFAULT_DAYS,
  send_email: true,
  message: '',
})
const submitting = ref(false)
const error = ref('')
const result = ref<{ url: string, email_error: string | null, emailed_at: string | null, expires_at: string } | null>(null)
const copied = ref(false)

const publishedForms = computed(() => forms.value.filter(f => f.latest_version))
const formOptions = computed(() => publishedForms.value.map(f => ({ value: f.id, label: `${f.name} (v${f.latest_version})` })))

watch(() => props.open, async (open) => {
  if (!open) return
  Object.assign(form, { form_id: props.formId ?? null, recipient_name: '', recipient_email: '', expires_in_days: FORM_LINK_DEFAULT_DAYS, send_email: true, message: '' })
  error.value = ''
  result.value = null
  copied.value = false
  loadingForms.value = true
  try {
    forms.value = await $fetch<FormOption[]>('/api/forms')
    if (!form.form_id && publishedForms.value.length === 1) form.form_id = publishedForms.value[0]!.id
  } finally {
    loadingForms.value = false
  }
}, { immediate: true })

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    result.value = await $fetch('/api/form-requests', {
      method: 'POST',
      body: {
        form_id: Number(form.form_id),
        business_id: props.businessId ?? null,
        recipient_name: form.recipient_name || null,
        recipient_email: form.recipient_email || null,
        expires_in_days: Number(form.expires_in_days) || FORM_LINK_DEFAULT_DAYS,
        send_email: form.send_email && !!form.recipient_email,
        message: form.message || null,
      },
    })
    emit('created')
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message || 'Could not create the link'
  } finally {
    submitting.value = false
  }
}

async function copy() {
  if (!result.value) return
  await navigator.clipboard.writeText(result.value.url)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

const { formatDate } = useFormatting()
</script>

<template>
  <Modal :open="open" title="Send a form" size="md" @close="emit('close')">
    <!-- Created: show the link once -->
    <div v-if="result" class="p-6 space-y-4">
      <div v-if="result.emailed_at" class="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
        <Icon name="lucide:mail-check" class="h-4 w-4" /> Emailed to {{ form.recipient_email }}
      </div>
      <p v-if="result.email_error" class="text-sm text-destructive">{{ result.email_error }}</p>
      <div class="space-y-1.5">
        <label class="text-sm font-medium">Link</label>
        <div class="flex gap-2">
          <input :value="result.url" readonly data-test="form-link" class="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono" @focus="($event.target as HTMLInputElement).select()">
          <Button variant="outline" @click="copy">
            <Icon :name="copied ? 'lucide:check' : 'lucide:copy'" class="h-4 w-4" />
            {{ copied ? 'Copied' : 'Copy' }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          Works once, until {{ formatDate(result.expires_at) }}. This is the only time the link is shown: only a fingerprint of it is stored.
        </p>
      </div>
      <div class="flex justify-end">
        <Button @click="emit('close')">Done</Button>
      </div>
    </div>

    <form v-else class="p-6 space-y-4" @submit.prevent="submit">
      <FormField label="Form" required>
        <p v-if="!loadingForms && !publishedForms.length" class="text-sm text-muted-foreground">
          No published forms yet. <NuxtLink to="/forms" class="text-primary underline">Create one</NuxtLink>.
        </p>
        <Select v-else v-model="form.form_id" :options="formOptions" placeholder="Choose a form" :disabled="!!formId" />
      </FormField>
      <div class="grid grid-cols-2 gap-3">
        <FormField label="Recipient name">
          <Input v-model="form.recipient_name" placeholder="Jane Smith" />
        </FormField>
        <FormField label="Recipient email">
          <Input v-model="form.recipient_email" type="email" placeholder="jane@example.com" />
        </FormField>
      </div>
      <FormField label="Expires after (days)" :hint="`1 to ${FORM_LINK_MAX_DAYS} days`">
        <Input v-model="form.expires_in_days" type="number" class="w-28" />
      </FormField>
      <label class="flex items-center gap-2 text-sm cursor-pointer" :class="!form.recipient_email && 'opacity-50'">
        <input v-model="form.send_email" type="checkbox" class="h-4 w-4 accent-primary" :disabled="!form.recipient_email">
        Email the link to the recipient
      </label>
      <FormField v-if="form.send_email && form.recipient_email" label="Message (optional)" hint="Replaces the standard opening line of the email">
        <Textarea v-model="form.message" :rows="3" />
      </FormField>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <Button variant="outline" @click="emit('close')">Cancel</Button>
        <Button type="submit" :loading="submitting" :disabled="!form.form_id">
          {{ form.send_email && form.recipient_email ? 'Create and email' : 'Create link' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>
