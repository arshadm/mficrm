export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    'nuxt-auth-utils',
    '@nuxt/icon',
    '@nuxtjs/color-mode',
  ],

  // Dark mode: adds `dark` to <html> (Tailwind darkMode: 'class'). Follows the OS until the user picks one
  // with ThemeToggle; the choice is kept in localStorage.
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light',
    storageKey: 'acquiredesk-color-mode',
  },

  // Register components by filename only (ui/Button.vue → <Button>, not <UiButton>)
  components: [
    { path: '~/components', pathPrefix: false },
  ],

  css: ['~/assets/css/main.css'],

  tailwindcss: {
    configPath: '~/tailwind.config.ts',
  },

  runtimeConfig: {
    sessionSecret: process.env.NUXT_SESSION_SECRET || 'changeme_random_32_char_string_xx',
    adminUsername: process.env.ADMIN_USERNAME || 'admin',
    adminPassword: process.env.ADMIN_PASSWORD || 'changeme',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || 'crm@example.com',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    databaseUrl: process.env.DATABASE_URL || './db/crm.db',
    public: {
      appName: 'AcquireDesk',
    },
  },

  typescript: {
    strict: false,
  },
})
