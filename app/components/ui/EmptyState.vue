<script setup lang="ts">
interface Props {
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}
const props = withDefaults(defineProps<Props>(), { icon: 'lucide:inbox' })
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="rounded-full bg-muted p-4 mb-4">
      <Icon :name="props.icon" class="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 class="text-lg font-semibold mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted-foreground mb-4 max-w-sm">{{ description }}</p>
    <Button v-if="actionLabel" @click="emit('action')">{{ actionLabel }}</Button>
  </div>
</template>
