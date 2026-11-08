<script setup lang="ts">
// Sub-navigation for the Settings pages
const route = useRoute()
const links = [
  { to: '/settings/users', label: 'Users', icon: 'lucide:users' },
  { to: '/settings/claude', label: 'Claude', icon: 'lucide:sparkles' },
  { to: '/settings/prompts', label: 'Chat prompts', icon: 'lucide:wand-sparkles' },
]
</script>

<template>
  <nav class="flex gap-1 border-b mb-4 -mx-1 overflow-x-auto">
    <NuxtLink
      v-for="l in links"
      :key="l.to"
      :to="l.to"
      :class="['flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap', route.path === l.to ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground']"
    >
      <Icon :name="l.icon" class="h-4 w-4" />
      {{ l.label }}
    </NuxtLink>
  </nav>
</template>
