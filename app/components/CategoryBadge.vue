<script setup lang="ts">
import { CATEGORY_LABELS } from '~/shared/types'
import type { BusinessCategory } from '~/shared/types'

interface Props { category: BusinessCategory }
defineProps<Props>()

const categoryColors: Record<string, string> = {
  fba: 'bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300',
  saas: 'bg-sky-100 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300',
  ios: 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300',
  android: 'bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300',
  content: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300',
  ecommerce: 'bg-pink-100 dark:bg-pink-500/15 text-pink-800 dark:text-pink-300',
  agency: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300',
  marketplace: 'bg-cyan-100 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300',
  newsletter: 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300',
  other: 'bg-gray-100 dark:bg-muted text-gray-700 dark:text-muted-foreground',
}
</script>

<template>
  <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', categoryColors[category] || categoryColors.other]">
    {{ CATEGORY_LABELS[category] }}
  </span>
</template>
