// Security headers on every response. Runs before the auth middleware (files run in name order), so 401s carry
// them too. The Content-Security-Policy for pages is set in server/plugins/csp.ts, because it needs a per-request
// nonce; stored files set their own sandbox CSP (server/utils/files.ts).
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    // Never framed (clickjacking); frame-ancestors in the CSP covers modern browsers
    'X-Frame-Options': 'DENY',
    // A private CRM: keep it out of search engines (the public form pages too)
    'X-Robots-Tag': 'noindex, nofollow',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  })
  if (!import.meta.dev) {
    // Production is HTTPS-only (Cloudflare and kamal-proxy). Browsers ignore this header over plain HTTP.
    setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
})
