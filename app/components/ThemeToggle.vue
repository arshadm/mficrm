<script setup lang="ts">
// Cycles system → light → dark. @nuxtjs/color-mode stores the choice and sets the `dark` class on <html>.
const colorMode = useColorMode()

const modes = [
  { value: 'system', icon: 'lucide:monitor', label: 'System theme' },
  { value: 'light', icon: 'lucide:sun', label: 'Light theme' },
  { value: 'dark', icon: 'lucide:moon', label: 'Dark theme' },
] as const

const current = computed(() => modes.find(m => m.value === colorMode.preference) ?? modes[0])

function cycle() {
  const i = modes.findIndex(m => m.value === current.value.value)
  colorMode.preference = modes[(i + 1) % modes.length].value
}
</script>

<template>
  <!-- ClientOnly: the stored preference is only known in the browser, so the server can't render the right icon -->
  <ClientOnly>
    <Button variant="ghost" size="icon" class="h-9 w-9" :title="`${current.label} (click to change)`" :aria-label="current.label" @click="cycle">
      <Icon :name="current.icon" class="h-4 w-4" />
    </Button>
    <template #fallback>
      <div class="h-9 w-9" />
    </template>
  </ClientOnly>
</template>
