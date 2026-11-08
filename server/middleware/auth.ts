export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname

  // Allow public paths
  if (
    path.startsWith('/api/auth/') ||
    path === '/api/health' ||
    path.startsWith('/api/public/') || // form links: authorised by the token, not a session
    path.startsWith('/api/_nuxt_icon/') || // icon SVG data (public, needed on /login)
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt_devtools__') ||
    path === '/login'
  ) {
    return
  }

  // Stored files need a session too (the route checks again)
  if (path.startsWith('/api/') || path.startsWith('/uploads/')) {
    const session = await getUserSession(event)
    if (!session?.user) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
  }
})
