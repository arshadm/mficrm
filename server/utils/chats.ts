import type { ChatMessage } from '~/shared/ai'
import { businessContext, firstTurn, type LoadedDocuments, type UserTurn } from './ai'

// Company chat (mficrm-bwv.2): building the request from a stored conversation.
//
// The CLI takes one user message per run, so the request is: the documents (cached), then the instructions, the
// company's current details, the team's notes, the conversation so far and the new question.

export const CHAT_INSTRUCTIONS = `You are chatting with a member of the team about this company. Answer their latest question from the documents, the company details and the team's notes, continuing the conversation so far if there is one.

- Be concise and specific. Use Markdown: short paragraphs, lists, tables for figures, bold for key numbers.
- When you rely on a document, cite it in square brackets with its exact name, adding the PDF page when you can: [listing.pdf, p. 3] or [P&L 2026.xlsx]. The user can click these to open the document.
- Say when the documents don't answer something, and don't invent figures.`

type BusinessDetails = Parameters<typeof businessContext>[0]

/** Completed question/answer pairs from a stored conversation (an unanswered question is left out). */
export function chatHistory(messages: ChatMessage[]): { question: string, answer: string }[] {
  const pairs: { question: string, answer: string }[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!
    const next = messages[i + 1]
    if (m.role === 'user' && next?.role === 'assistant' && next.text.trim()) {
      pairs.push({ question: m.text, answer: next.text })
      i++
    }
  }
  return pairs
}

// Earlier turns are sent as a transcript inside the one message the CLI takes: the newest turns in full, older
// ones dropped once the transcript passes this size (the user is told in the transcript that it was shortened).
const MAX_HISTORY_CHARS = 120_000

export function chatRequest(docs: LoadedDocuments, business: BusinessDetails, notesHtml: string, history: { question: string, answer: string }[], question: string): UserTurn[] {
  const notes = notesHtml.trim()
    ? `<company_notes>\n${notesHtml.replace(/<img[^>]*>/g, '')}\n</company_notes>`
    : '<company_notes>(none yet)</company_notes>'
  const kept: string[] = []
  let size = 0
  for (const pair of [...history].reverse()) {
    const entry = `<turn>\n<question>${pair.question}</question>\n<your_answer>${pair.answer}</your_answer>\n</turn>`
    if (size + entry.length > MAX_HISTORY_CHARS) break
    kept.unshift(entry)
    size += entry.length
  }
  const transcript = history.length
    ? `<conversation_so_far${kept.length < history.length ? ' note="earlier turns left out"' : ''}>\n${kept.join('\n')}\n</conversation_so_far>`
    : ''
  return [firstTurn(docs, CHAT_INSTRUCTIONS, businessContext(business), notes, transcript, `Question: ${question}`)]
}

/** A conversation row in the API shape */
export function chatRow(chat: { id: number, business_id: number, title: string, messages: unknown, created_at: Date, updated_at: Date, creator?: { username: string } | null }) {
  return {
    id: chat.id,
    business_id: chat.business_id,
    title: chat.title,
    messages: (chat.messages ?? []) as ChatMessage[],
    created_at: chat.created_at,
    updated_at: chat.updated_at,
    created_by_username: chat.creator?.username ?? null,
  }
}
