export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Allow public paths
  if (
    path.startsWith('/api/auth/') ||
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt_devtools__') ||
    path === '/login' ||
    path.startsWith('/uploads/')
  ) {
    return
  }

  if (path.startsWith('/api/')) {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
  }
})
