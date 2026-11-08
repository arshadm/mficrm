import sanitizeHtml from 'sanitize-html'

// Rich-text fields hold HTML from the Tiptap editor (StarterKit) and some are rendered with v-html
// (RichText.vue). Never trust the client: every rich-text value is sanitised on write against what the editor can
// produce, and plain text is escaped before it's wrapped in HTML.

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 's', 'strike', 'u', 'code', 'pre', 'blockquote',
    'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    // Links open in a new tab without giving the target page access to this one
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
  },
}

/** Sanitises editor HTML. null/undefined pass through so "leave unchanged" and "clear" keep their meaning. */
export function sanitizeRichText<T extends string | null | undefined>(value: T): T {
  if (value === null || value === undefined) return value
  return sanitizeHtml(value, OPTIONS) as T
}

// Company notes (mficrm-bwv.1) use a fuller editor: tables, checklists and images on top of the above. Images may
// only point at files stored by this app (/uploads/…), so notes can't load anything from elsewhere.
const NOTES_OPTIONS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  allowedTags: [
    ...(OPTIONS.allowedTags as string[]),
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'img', 'label', 'input', 'div', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    th: ['colspan', 'rowspan', 'colwidth'],
    td: ['colspan', 'rowspan', 'colwidth'],
    img: ['src', 'alt', 'title'],
    ul: ['data-type'],
    li: ['data-type', 'data-checked'],
    input: ['type', 'checked', 'disabled'],
  },
  allowedSchemesByTag: { img: [] },
  exclusiveFilter: frame =>
    (frame.tag === 'img' && !/^\/uploads\/[0-9a-f]{32}\.(png|jpe?g|gif|webp)$/.test(frame.attribs.src || ''))
    || (frame.tag === 'input' && frame.attribs.type !== 'checkbox'),
}

/** Sanitises company-notes HTML (tables, checklists, images stored by this app). */
export function sanitizeNotes(value: string): string {
  return sanitizeHtml(value, NOTES_OPTIONS)
}

/** Escapes plain text for inclusion in HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
