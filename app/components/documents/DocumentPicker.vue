<script setup lang="ts">
// Picks documents before the company exists (new business page); they are uploaded after it's created
const model = defineModel<File[]>({ default: () => [] })
const input = ref<HTMLInputElement | null>(null)
const ACCEPT = ['.pdf', '.csv', '.xlsx', '.xls']
const error = ref('')

function add(files: FileList | null) {
  error.value = ''
  const list = Array.from(files ?? [])
  const bad = list.filter(f => !ACCEPT.some(ext => f.name.toLowerCase().endsWith(ext)))
  const big = list.filter(f => f.size > 20 * 1024 * 1024)
  if (bad.length) error.value = `Not accepted: ${bad.map(f => f.name).join(', ')} (PDF, CSV or Excel only)`
  else if (big.length) error.value = `Larger than 20 MB: ${big.map(f => f.name).join(', ')}`
  const ok = list.filter(f => !bad.includes(f) && !big.includes(f) && !model.value.some(m => m.name === f.name && m.size === f.size))
  model.value = [...model.value, ...ok]
  if (input.value) input.value.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <div
      class="rounded-md border-2 border-dashed p-4 text-center text-sm text-muted-foreground cursor-pointer hover:bg-muted/40"
      @click="input?.click()"
      @dragover.prevent
      @drop.prevent="add($event.dataTransfer?.files ?? null)"
    >
      <Icon name="lucide:upload" class="h-5 w-5 mx-auto mb-1" />
      Listing export (PDF) and P&amp;L accounts (CSV or Excel). Click or drop files here.
    </div>
    <input ref="input" type="file" multiple :accept="ACCEPT.join(',')" class="hidden" data-test="doc-picker" @change="add(($event.target as HTMLInputElement).files)">
    <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
    <ul v-if="model.length" class="space-y-1">
      <li v-for="(f, i) in model" :key="f.name + f.size" class="flex items-center gap-2 text-sm">
        <Icon :name="/\.pdf$/i.test(f.name) ? 'lucide:file-text' : 'lucide:file-spreadsheet'" class="h-4 w-4 text-muted-foreground" />
        <span class="flex-1 truncate">{{ f.name }}</span>
        <span class="text-xs text-muted-foreground">{{ Math.max(1, Math.round(f.size / 1024)) }} KB</span>
        <button type="button" class="text-muted-foreground hover:text-destructive" :aria-label="`Remove ${f.name}`" @click="model = model.filter((_, j) => j !== i)">
          <Icon name="lucide:x" class="h-4 w-4" />
        </button>
      </li>
    </ul>
  </div>
</template>
