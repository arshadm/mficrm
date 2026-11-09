<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

async function handleLogin(event: Event) {
  error.value = ''
  // Read what's in the fields: a password manager's autofill, or typing before the page finished loading, can fill
  // them without updating `form`
  const data = new FormData(event.target as HTMLFormElement)
  const username = String(data.get('username') ?? form.username).trim()
  const password = String(data.get('password') ?? form.password)
  if (!username || !password) {
    error.value = 'Enter your username and password'
    return
  }
  loading.value = true
  try {
    await authStore.login(username, password)
    // Back to the page the visitor originally asked for (same-site paths only)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') && !route.query.redirect.startsWith('//')
      ? route.query.redirect
      : '/dashboard'
    await router.push(redirect)
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
          <Input v-model="form.username" name="username" placeholder="admin" autocomplete="username" />
        </FormField>
        <FormField label="Password" required>
          <Input v-model="form.password" name="password" type="password" placeholder="••••••••" autocomplete="current-password" />
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
