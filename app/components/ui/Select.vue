<script setup lang="ts">
interface Option {
  value: string | number
  label: string
}

interface Props {
  modelValue?: string | number | null
  options: Option[]
  placeholder?: string
  disabled?: boolean
  class?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), { placeholder: 'Select...' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <select
    :id="id"
    :value="modelValue ?? ''"
    :disabled="disabled"
    :class="[
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2',
      'text-sm ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      props.class
    ]"
    @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option value="">{{ placeholder }}</option>
    <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
  </select>
</template>
