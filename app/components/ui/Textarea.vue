<script setup lang="ts">
interface Props {
  modelValue?: string | null
  placeholder?: string
  disabled?: boolean
  rows?: number
  class?: string
}
const props = withDefaults(defineProps<Props>(), { rows: 3 })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :class="[
      'flex w-full rounded-md border border-input bg-background px-3 py-2',
      'text-sm ring-offset-background',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50 resize-y',
      props.class
    ]"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
