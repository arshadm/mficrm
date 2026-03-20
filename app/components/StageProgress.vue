<script setup lang="ts">
import { STAGE_LABELS } from '~/shared/types'
import type { BusinessStage } from '~/shared/types'

interface Props { stage: BusinessStage }
defineProps<Props>()

const stages: BusinessStage[] = [
  'initial_interest', 'qualified', 'seller_engaged',
  'offer_made', 'offer_accepted'
]

const terminalStages: BusinessStage[] = ['rejected', 'offer_rejected']
</script>

<template>
  <div class="w-full">
    <div v-if="terminalStages.includes(stage)" class="flex items-center gap-2 text-destructive">
      <Icon name="lucide:x-circle" class="h-5 w-5" />
      <span class="font-medium">{{ STAGE_LABELS[stage] }}</span>
    </div>
    <div v-else class="flex items-center gap-1">
      <template v-for="(s, i) in stages" :key="s">
        <div class="flex flex-col items-center gap-1">
          <div :class="[
            'h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
            s === stage ? 'bg-primary border-primary text-primary-foreground' :
            stages.indexOf(stage) > i ? 'bg-primary/20 border-primary text-primary' :
            'bg-muted border-muted-foreground/30 text-muted-foreground'
          ]">
            <Icon v-if="stages.indexOf(stage) > i" name="lucide:check" class="h-4 w-4" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="text-xs text-muted-foreground hidden sm:block text-center max-w-16 leading-tight">
            {{ STAGE_LABELS[s].split(' ')[0] }}
          </span>
        </div>
        <div v-if="i < stages.length - 1" :class="[
          'flex-1 h-0.5 mb-5',
          stages.indexOf(stage) > i ? 'bg-primary' : 'bg-muted'
        ]" />
      </template>
    </div>
  </div>
</template>
