<script setup lang="ts">
interface Props { content?: string | null }
defineProps<Props>()
</script>

<template>
  <div v-if="content" class="rich-text text-sm" v-html="content" />
  <span v-else class="text-muted-foreground text-sm italic">—</span>
</template>
