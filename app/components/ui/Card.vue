<script setup lang="ts">
interface Props { class?: string }
const props = defineProps<Props>()
</script>

<template>
  <div :class="['rounded-lg border bg-card text-card-foreground shadow-sm', props.class]">
    <slot />
  </div>
</template>
