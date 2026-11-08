import { randomBytes } from 'crypto'

// Content-Security-Policy for server-rendered pages. Nuxt and @nuxtjs/color-mode emit inline <script> tags (the
// colour-mode one sets the theme before first paint), so each response gets a fresh nonce that is stamped onto the
// page's own inline scripts; anything injected without it is blocked. Production only: Vite's dev server relies on
// inline code and websockets.
//
// style-src allows 'unsafe-inline' because Vue and Chart.js set style attributes, which nonces can't cover.

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return

  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const nonce = randomBytes(16).toString('base64')
    const stamp = (parts: string[]) => parts.map(part => part.replace(/<script(?![^>]*\snonce=)/g, `<script nonce="${nonce}"`))
    html.head = stamp(html.head)
    html.bodyPrepend = stamp(html.bodyPrepend)
    html.body = stamp(html.body)
    html.bodyAppend = stamp(html.bodyAppend)

    setResponseHeader(event, 'Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '))
  })
})
