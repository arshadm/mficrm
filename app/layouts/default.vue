<script setup lang="ts">
const sidebarOpen = ref(false)
const route = useRoute()
const authStore = useAuthStore()

const navItems = [
  { to: '/dashboard', icon: 'lucide:layout-dashboard', label: 'Dashboard' },
  { to: '/calendar', icon: 'lucide:calendar-days', label: 'Calendar' },
  { to: '/pipeline', icon: 'lucide:kanban', label: 'Pipeline' },
  { to: '/businesses', icon: 'lucide:briefcase', label: 'Businesses' },
  { to: '/settings/users', icon: 'lucide:settings', label: 'Settings' },
]

const searchQuery = ref('')
const searchResults = ref<Array<{ id: number, name: string, stage: string }>>([])
const searchLoading = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (!val.trim()) { searchResults.value = []; return }
  searchTimeout = setTimeout(async () => {
    searchLoading.value = true
    try {
      searchResults.value = await $fetch('/api/businesses', { query: { search: val } }) as Array<{ id: number, name: string, stage: string }>
    } finally {
      searchLoading.value = false
    }
  }, 300)
})

function closeSidebar() { sidebarOpen.value = false }
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      @click="closeSidebar"
    />

    <!-- Sidebar -->
    <aside :class="[
      'fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300',
      'lg:static lg:translate-x-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    ]">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-6 py-5 border-b">
        <div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <Icon name="lucide:trending-up" class="h-5 w-5 text-primary-foreground" />
        </div>
        <span class="font-bold text-lg">AcquireDesk</span>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="[
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            route.path.startsWith(item.to)
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          ]"
          @click="closeSidebar"
        >
          <Icon :name="item.icon" class="h-5 w-5 shrink-0" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <!-- User -->
      <div class="border-t p-3">
        <div class="flex items-center gap-3 px-3 py-2">
          <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span class="text-xs font-bold text-primary uppercase">
              {{ authStore.user?.username?.[0] ?? 'U' }}
            </span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ authStore.user?.username }}</p>
            <p class="text-xs text-muted-foreground capitalize">{{ authStore.user?.role }}</p>
          </div>
          <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" @click="authStore.logout()">
            <Icon name="lucide:log-out" class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Top bar -->
      <header class="h-16 border-b bg-card flex items-center gap-4 px-4 shrink-0">
        <button class="lg:hidden p-2 text-muted-foreground" @click="sidebarOpen = true">
          <Icon name="lucide:menu" class="h-5 w-5" />
        </button>

        <!-- Search -->
        <div class="relative flex-1 max-w-md">
          <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search businesses..."
            class="w-full pl-9 pr-4 h-9 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <!-- Search results dropdown -->
          <div
            v-if="searchQuery && (searchResults.length || searchLoading)"
            class="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 overflow-hidden"
          >
            <div v-if="searchLoading" class="p-3 text-sm text-muted-foreground text-center">
              Searching...
            </div>
            <template v-else>
              <NuxtLink
                v-for="r in searchResults.slice(0, 8)"
                :key="r.id"
                :to="`/businesses/${r.id}`"
                class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                @click="searchQuery = ''"
              >
                <Icon name="lucide:briefcase" class="h-4 w-4 text-muted-foreground" />
                <span>{{ r.name }}</span>
                <StageBadge :stage="(r.stage as any)" class="ml-auto" />
              </NuxtLink>
              <div v-if="!searchResults.length" class="p-3 text-sm text-muted-foreground text-center">
                No results found
              </div>
            </template>
          </div>
        </div>

        <div class="ml-auto">
          <NuxtLink to="/businesses/new">
            <Button size="sm">
              <Icon name="lucide:plus" class="h-4 w-4" />
              <span class="hidden sm:inline">Add Business</span>
            </Button>
          </NuxtLink>
        </div>
      </header>

      <!-- Content -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>
