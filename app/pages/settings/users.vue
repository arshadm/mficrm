<script setup lang="ts">
import type { User } from '~/shared/types'

const authStore = useAuthStore()
const { formatDate } = useFormatting()

const users = ref<User[]>([])
const loading = ref(true)
const showAddModal = ref(false)

const form = reactive({ username: '', password: '', email: '', role: 'user' })
const saving = ref(false)
const error = ref('')

async function fetchUsers() {
  loading.value = true
  try {
    users.value = await $fetch<User[]>('/api/settings/users')
  } finally {
    loading.value = false
  }
}

async function addUser() {
  error.value = ''
  if (!form.username || !form.password) { error.value = 'Username and password are required'; return }
  saving.value = true
  try {
    const user = await $fetch<User>('/api/settings/users', {
      method: 'POST',
      body: { ...form },
    })
    users.value.push(user)
    showAddModal.value = false
    Object.assign(form, { username: '', password: '', email: '', role: 'user' })
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message || 'Failed to create user'
  } finally {
    saving.value = false
  }
}

async function deleteUser(id: number) {
  if (id === authStore.user?.id) return alert('Cannot delete yourself')
  if (!confirm('Delete this user?')) return
  await $fetch(`/api/settings/users/${id}`, { method: 'DELETE' })
  users.value = users.value.filter(u => u.id !== id)
}

onMounted(fetchUsers)
</script>

<template>
  <div class="p-6 max-w-2xl space-y-4">
    <SettingsNav />
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">User Management</h1>
        <p class="text-muted-foreground">Manage team members and access</p>
      </div>
      <Button @click="showAddModal = true">
        <Icon name="lucide:plus" class="h-4 w-4" />
        Add User
      </Button>
    </div>

    <Card class="divide-y">
      <div v-if="loading" class="p-6 text-center text-muted-foreground">Loading...</div>
      <div
        v-for="user in users"
        :key="user.id"
        class="flex items-center gap-3 px-4 py-3"
      >
        <div class="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span class="text-sm font-bold text-primary uppercase">{{ user.username[0] }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium text-sm">{{ user.username }}</p>
          <p class="text-xs text-muted-foreground">{{ user.email || 'No email' }} · Joined {{ formatDate(user.created_at) }}</p>
        </div>
        <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground']">
          {{ user.role }}
        </span>
        <button
          v-if="user.id !== authStore.user?.id"
          class="text-muted-foreground hover:text-destructive"
          @click="deleteUser(user.id)"
        >
          <Icon name="lucide:trash-2" class="h-4 w-4" />
        </button>
      </div>
    </Card>

    <Modal :open="showAddModal" title="Add User" @close="showAddModal = false">
      <div class="p-6 space-y-4">
        <div v-if="error" class="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{{ error }}</div>
        <FormField label="Username" required>
          <Input v-model="form.username" placeholder="john.doe" />
        </FormField>
        <FormField label="Email">
          <Input v-model="form.email" type="email" placeholder="john@company.com" />
        </FormField>
        <FormField label="Password" required>
          <Input v-model="form.password" type="password" placeholder="Min. 8 characters" />
        </FormField>
        <FormField label="Role">
          <Select v-model="form.role" :options="[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]" />
        </FormField>
        <div class="flex gap-3">
          <Button :loading="saving" @click="addUser">Create User</Button>
          <Button variant="outline" @click="showAddModal = false">Cancel</Button>
        </div>
      </div>
    </Modal>
  </div>
</template>
