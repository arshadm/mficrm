<script setup lang="ts">
interface Tab {
  id: string
  label: string
  icon?: string
}

interface Props {
  tabs: Tab[]
  modelValue: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div>
    <div class="border-b border-border">
      <nav class="flex -mb-px overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
            modelValue === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          ]"
          @click="emit('update:modelValue', tab.id)"
        >
          <!-- Icons only on wide screens, so long tab rows fit without scrolling -->
          <Icon v-if="tab.icon" :name="tab.icon" class="h-4 w-4 hidden 2xl:block" />
          {{ tab.label }}
        </button>
      </nav>
    </div>
    <slot />
  </div>
</template>
