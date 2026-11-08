<script setup lang="ts">
import type { FormAnswers, FormSchema } from '~/shared/forms'
import { submissionErrors } from '~/shared/forms'

// Public form page, reached through a link token (mficrm-xln.5). No login: the token is the only authority.
definePageMeta({ layout: 'public' })
useHead({ title: 'Form', meta: [{ name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'no-referrer' }] })

interface PublicForm { name: string, description: string | null, schema: FormSchema, expires_at: string }

const route = useRoute()
const token = String(route.params.token)
const { data: form, error } = await useFetch<PublicForm>(`/api/public/forms/${token}`, { key: `public-form-${token}` })
if (form.value) useHead({ title: form.value.name })

// What went wrong loading it: not found (404), or expired / revoked / already submitted (410)
const problem = computed(() => {
  if (!error.value) return null
  const status = error.value.statusCode
  const message = (error.value.data as { message?: string })?.message
  if (status === 404) return { title: 'Form not found', text: 'Check the link you were sent. It may have been copied incompletely.' }
  if (status === 410) return { title: 'This link can no longer be used', text: message || 'Please ask the sender for a new link.' }
  if (status === 429) return { title: 'Too many requests', text: 'Please wait a few minutes and try again.' }
  return { title: 'Something went wrong', text: 'Please try again later.' }
})

const answers = ref<FormAnswers>({})
const files = ref<Record<string, File[]>>({})
const errors = ref<Record<string, string>>({})
const submitting = ref(false)
const submitError = ref('')
const submitted = ref(false)

onMounted(() => {
  // Counts as opened only when a browser actually runs the page (not a link scanner)
  if (form.value) $fetch(`/api/public/forms/${token}/open`, { method: 'POST' }).catch(() => {})
})

const renderer = ref<{ validate: () => Promise<boolean> } | null>(null)

// After a failed attempt, the summary message goes once every answer passes
watch([answers, files], async () => {
  if (!submitError.value || !form.value || submitting.value) return
  if (await renderer.value?.validate() && !Object.keys(submissionErrors(form.value.schema, answers.value)).length) {
    submitError.value = ''
    errors.value = {}
  }
}, { deep: true })

async function submit() {
  if (!form.value) return
  submitError.value = ''
  errors.value = {}
  // FormKit's validation first (messages update as answers are corrected), then the same check the server runs
  const ok = await renderer.value?.validate()
  if (ok) errors.value = submissionErrors(form.value.schema, answers.value)
  if (!ok || Object.keys(errors.value).length) {
    submitError.value = 'Please check the highlighted answers.'
    await nextTick()
    document.querySelector('[data-invalid], [data-errors]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const body = new FormData()
  const fileFieldIds = new Set(form.value.schema.fields.filter(f => f.type === 'file').map(f => f.id))
  body.append('answers', JSON.stringify(Object.fromEntries(Object.entries(answers.value).filter(([id]) => !fileFieldIds.has(id)))))
  for (const [id, list] of Object.entries(files.value)) for (const file of list) body.append(`file:${id}`, file, file.name)

  submitting.value = true
  try {
    await $fetch(`/api/public/forms/${token}`, { method: 'POST', body })
    submitted.value = true
    window.scrollTo({ top: 0 })
  } catch (e: unknown) {
    const err = e as { statusCode?: number, data?: { message?: string, data?: { errors?: Record<string, string> } } }
    errors.value = err.data?.data?.errors ?? {}
    submitError.value = err.data?.message || 'The form could not be sent. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <Card v-if="submitted" class="p-8 text-center space-y-3" data-test="submitted">
      <div class="mx-auto w-fit rounded-full bg-green-100 dark:bg-green-500/15 p-3">
        <Icon name="lucide:check" class="h-7 w-7 text-green-700 dark:text-green-300" />
      </div>
      <h1 class="text-xl font-semibold">Thank you</h1>
      <p class="text-muted-foreground">Your answers have been sent. You can close this page.</p>
    </Card>

    <Card v-else-if="problem" class="p-8 text-center space-y-3" data-test="link-problem">
      <div class="mx-auto w-fit rounded-full bg-muted p-3">
        <Icon name="lucide:link-2-off" class="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 class="text-xl font-semibold">{{ problem.title }}</h1>
      <p class="text-muted-foreground">{{ problem.text }}</p>
    </Card>

    <Card v-else-if="form" class="p-6 sm:p-8">
      <form class="space-y-6" novalidate @submit.prevent="submit">
        <div>
          <h1 class="text-2xl font-bold">{{ form.name }}</h1>
          <p v-if="form.description" class="text-muted-foreground mt-2 whitespace-pre-line">{{ form.description }}</p>
        </div>
        <FormRenderer ref="renderer" v-model="answers" v-model:files="files" :schema="form.schema" :errors="errors" :disabled="submitting" />
        <div class="space-y-3 border-t pt-5">
          <p v-if="submitError" class="text-sm text-destructive" role="alert">{{ submitError }}</p>
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <p class="text-xs text-muted-foreground">You can submit this form once.</p>
            <Button type="submit" :loading="submitting">Submit</Button>
          </div>
        </div>
      </form>
    </Card>
  </div>
</template>
