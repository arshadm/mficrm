// Every page requires a login except /login and the public form pages (/f/*, see mficrm-xln). The session is loaded
// during server rendering by nuxt-auth-utils, so logged-out visitors are redirected before any CRM page renders.
// (The API is guarded separately, in server/middleware/auth.ts.)
const PUBLIC_PREFIXES = ['/f/']

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  if (to.path === '/login') {
    // Already logged in: skip the login page
    if (loggedIn.value) return navigateTo('/dashboard')
    return
  }
  if (PUBLIC_PREFIXES.some(p => to.path.startsWith(p))) return

  if (!loggedIn.value) {
    // Come back to the requested page after logging in
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined })
  }
})
