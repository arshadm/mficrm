<!-- Layout for public form pages (/f/*): no CRM navigation or data, just the form -->
<template>
  <div class="relative min-h-screen bg-muted/30">
    <div class="absolute top-4 right-4">
      <ThemeToggle />
    </div>
    <main class="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <slot />
    </main>
  </div>
</template>
