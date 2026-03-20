<script setup lang="ts">
import { STAGE_LABELS, STAGE_COLORS } from '~/shared/types'
import type { BusinessStage } from '~/shared/types'

interface Props { stage: BusinessStage }
defineProps<Props>()
</script>

<template>
  <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STAGE_COLORS[stage]]">
    {{ STAGE_LABELS[stage] }}
  </span>
</template>
