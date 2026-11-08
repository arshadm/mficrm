import DOMPurify from 'dompurify'
import { marked } from 'marked'

// Rendering Claude's chat answers (mficrm-bwv.2): Markdown via marked, sanitised with DOMPurify, with document
// citations ([listing.pdf, p. 3], [P&L.xlsx], or several separated by ";") turned into links that open the
// document (PDFs at the page). Browser only: DOMPurify needs the DOM.

export interface CitableDocument { filename: string, original_name: string }

let hooked = false
function purify(html: string): string {
  if (!hooked) {
    // Links open in a new tab, without access back to this page
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer nofollow')
      }
    })
    hooked = true
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'img'] })
}

function linkCitations(md: string, docs: CitableDocument[]): string {
  if (!docs.length) return md
  const byName = new Map(docs.map(d => [d.original_name.trim().toLowerCase(), d]))
  return md.replace(/\[([^[\]\n]{1,300})\](?!\()/g, (whole, inner: string) => {
    const parts = inner.split(';').map(p => p.trim())
    const links = parts.map((part) => {
      const m = part.match(/^(.*?)(?:,\s*pp?\.\s*(\d+)(?:\s*[–-]\s*\d+)?)?$/)
      const doc = m && byName.get(m[1]!.trim().toLowerCase())
      if (!doc) return null
      const page = m![2] && /\.pdf$/i.test(doc.filename) ? `#page=${m![2]}` : ''
      return `[${part.replace(/[[\]]/g, '')}](/uploads/${doc.filename}${page})`
    })
    return links.every(Boolean) ? links.join('; ') : whole
  })
}

export function renderChatMarkdown(md: string, docs: CitableDocument[] = []): string {
  const html = marked.parse(linkCitations(md, docs), { gfm: true, breaks: true, async: false }) as string
  return purify(html)
}

/** HTML for adding an answer to the notes (the server sanitises it again when the notes are saved) */
export function answerToNotesHtml(question: string, md: string, docs: CitableDocument[] = []): string {
  const q = question.length > 80 ? `${question.slice(0, 77)}…` : question
  const heading = document.createElement('em')
  heading.textContent = `Claude, on “${q}”:`
  return `<p>${heading.outerHTML}</p>${renderChatMarkdown(md, docs)}<p></p>`
}
