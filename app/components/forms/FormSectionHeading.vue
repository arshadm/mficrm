<script setup lang="ts">
// Section heading inside a FormKit-rendered form ($cmp node; the text is passed as plain props)
defineProps<{ title?: string, body?: string }>()
</script>

<template>
  <div class="pt-2 first:pt-0">
    <h3 class="text-base font-semibold">{{ title }}</h3>
    <p v-if="body" class="text-sm text-muted-foreground mt-1 whitespace-pre-line">{{ body }}</p>
    <div class="border-b mt-2" />
  </div>
</template>
