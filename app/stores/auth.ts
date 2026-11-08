import { defineStore } from 'pinia'
import type { User } from '~/shared/types'

// The logged-in user comes from nuxt-auth-utils' session state, which is loaded during server rendering, so the
// server and the browser render the same user (no hydration mismatch, no extra /api/auth/me request).
export const useAuthStore = defineStore('auth', () => {
  const loading = ref(false)
  const { fetch: refreshSession, session, user: sessionUser } = useUserSession()
  const user = computed(() => (sessionUser.value as User | null) ?? null)

  async function login(username: string, password: string) {
    loading.value = true
    try {
      const data = await $fetch<User>('/api/auth/login', {
        method: 'POST',
        body: { username, password },
      })
      await refreshSession()
      return data
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    session.value = null
    await navigateTo('/login')
  }

  return { user, loading, login, logout }
})
