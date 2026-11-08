<script setup lang="ts">
import type { FormAnswers, FormSchema } from '~/shared/forms'

interface Submission {
  id: number
  submitted_at: string
  answers: FormAnswers
  attachments: { id: number, filename: string, original_name: string, file_size: number | null }[]
  form_id: number
  form_name: string
  version: number
  schema: FormSchema
  business_id: number | null
  business_name: string | null
  recipient_name: string | null
  recipient_email: string | null
  link_created_at: string
  link_created_by_username: string | null
}

const route = useRoute()
const router = useRouter()
const { formatDateTime } = useFormatting()
const requestFetch = useRequestFetch() // forwards the session cookie during server rendering
const { data: sub, error } = await useAsyncData(`submission-${route.params.id}`, () => requestFetch<Submission>(`/api/form-submissions/${route.params.id}`))
</script>

<template>
  <div v-if="error || !sub" class="p-6">
    <EmptyState title="Submission not found" icon="lucide:search" action-label="Back" @action="router.back()" />
  </div>
  <div v-else class="p-6 max-w-3xl space-y-4">
    <div class="flex items-start gap-3">
      <button class="text-muted-foreground hover:text-foreground mt-1.5" aria-label="Back" @click="router.back()">
        <Icon name="lucide:arrow-left" class="h-5 w-5" />
      </button>
      <div>
        <h1 class="text-2xl font-bold">{{ sub.form_name }}</h1>
        <p class="text-sm text-muted-foreground">
          Submitted {{ formatDateTime(sub.submitted_at) }}
          <template v-if="sub.recipient_name || sub.recipient_email"> by {{ sub.recipient_name || sub.recipient_email }}</template>
          <template v-if="sub.recipient_name && sub.recipient_email"> ({{ sub.recipient_email }})</template>
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          <NuxtLink :to="`/forms/${sub.form_id}`" class="hover:underline">Version {{ sub.version }}</NuxtLink>
          <template v-if="sub.business_id"> · <NuxtLink :to="`/businesses/${sub.business_id}?tab=forms`" class="hover:underline">{{ sub.business_name }}</NuxtLink></template>
          <template v-if="sub.link_created_by_username"> · link sent by {{ sub.link_created_by_username }}</template>
        </p>
      </div>
    </div>
    <Card class="p-6">
      <FormAnswersView :schema="sub.schema" :answers="sub.answers" :attachments="sub.attachments" />
    </Card>
  </div>
</template>
