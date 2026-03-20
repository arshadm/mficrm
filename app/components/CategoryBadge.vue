<script setup lang="ts">
import { CATEGORY_LABELS } from '~/shared/types'
import type { BusinessCategory } from '~/shared/types'

interface Props { category: BusinessCategory }
defineProps<Props>()

const categoryColors: Record<string, string> = {
  fba: 'bg-orange-100 text-orange-800',
  saas: 'bg-sky-100 text-sky-800',
  ios: 'bg-purple-100 text-purple-800',
  android: 'bg-green-100 text-green-800',
  content: 'bg-yellow-100 text-yellow-800',
  ecommerce: 'bg-pink-100 text-pink-800',
  agency: 'bg-indigo-100 text-indigo-800',
  marketplace: 'bg-cyan-100 text-cyan-800',
  newsletter: 'bg-rose-100 text-rose-800',
  other: 'bg-gray-100 text-gray-700',
}
</script>

<template>
  <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', categoryColors[category] || categoryColors.other]">
    {{ CATEGORY_LABELS[category] }}
  </span>
</template>
