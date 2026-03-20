<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    await router.push('/dashboard')
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string }, message?: string })?.data?.message || 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm">
    <Card class="p-8">
      <div class="flex flex-col items-center mb-8">
        <div class="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
          <Icon name="lucide:trending-up" class="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 class="text-2xl font-bold">AcquireDesk</h1>
        <p class="text-muted-foreground text-sm mt-1">Sign in to your account</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleLogin">
        <FormField label="Username" required>
          <Input v-model="form.username" placeholder="admin" autocomplete="username" />
        </FormField>
        <FormField label="Password" required>
          <Input v-model="form.password" type="password" placeholder="••••••••" autocomplete="current-password" />
        </FormField>

        <div v-if="error" class="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {{ error }}
        </div>

        <Button type="submit" class="w-full" :loading="loading">
          Sign In
        </Button>
      </form>
    </Card>
  </div>
</template>
