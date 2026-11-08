import { z } from 'zod'
import { BusinessCategoryEnum } from './schemas'
import { FORM_FIELD_TYPES, FORM_FILE_EXTENSIONS } from './forms'

// Shapes of Claude's structured answers (mficrm-b6g). Used by the server as structured-output schemas and by the
// pages for types. Optional values are nullable rather than absent, as structured outputs require.
//
// Choice fields are plain strings listing the allowed values in their description, and are checked by our own
// code afterwards, so one out-of-list value doesn't throw away the whole answer.

/** Prefill for a new company, read from its documents */
export const AiPrefillSchema = z.object({
  name: z.string().nullable().describe('Business or brand name'),
  category: z.string().nullable().describe(`One of: ${BusinessCategoryEnum.options.join(', ')}`),
  platform: z.string().nullable().describe('Marketplace it is listed on, e.g. Flippa'),
  listing_url: z.string().nullable(),
  asking_price: z.number().nullable(),
  trailing_12m_revenue: z.number().nullable().describe('Revenue over the last 12 months'),
  trailing_12m_profit: z.number().nullable().describe('Net profit over the last 12 months'),
  date_listed: z.string().nullable().describe('YYYY-MM-DD'),
  description: z.string().nullable().describe('Two or three plain sentences: what the business is and how it makes money'),
  notes: z.array(z.string()).describe('Anything the user should check: missing figures, inconsistencies, assumptions made'),
})
export type AiPrefill = z.infer<typeof AiPrefillSchema>

/** Summary of a company's documents, stored on the business */
export const AiSummarySchema = z.object({
  overview: z.string().describe('One paragraph: what the business is, how it makes money, its size and age'),
  financials: z.array(z.object({
    label: z.string(),
    value: z.string(),
    note: z.string().nullable(),
  })).describe('Key figures found in the documents, e.g. trailing 12-month revenue, profit, margin, asking multiple, growth'),
  strengths: z.array(z.string()),
  risks: z.array(z.string()).describe('Risks and red flags for a buyer'),
  questions_for_seller: z.array(z.string()).describe('Questions to ask the seller before making an offer'),
  data_gaps: z.array(z.string()).describe('Information missing from the documents or inconsistent between them'),
})
export type AiSummary = z.infer<typeof AiSummarySchema>

/** A form drafted for a company; converted to a FormSchema (ids added, nulls dropped) and checked before saving */
export const AiFormDraftSchema = z.object({
  name: z.string().describe('Form title shown to the recipient'),
  description: z.string().describe('Short introduction shown at the top of the form, addressed to the recipient'),
  fields: z.array(z.object({
    type: z.string().describe(`One of: ${FORM_FIELD_TYPES.join(', ')}`),
    label: z.string().describe('The question, or the heading for a section'),
    help: z.string().nullable().describe('Help text under the question, or the body text of a section'),
    required: z.boolean(),
    placeholder: z.string().nullable(),
    options: z.array(z.string()).nullable().describe('Choices, for single_select and multi_select only'),
    min: z.number().nullable(),
    max: z.number().nullable(),
    accept: z.array(z.string()).nullable().describe(`Accepted file types, for file fields only. Any of: ${FORM_FILE_EXTENSIONS.join(', ')}`),
    maxFiles: z.number().int().nullable().describe('For file fields only, 1 to 10'),
  })),
})
export type AiFormDraft = z.infer<typeof AiFormDraftSchema>

/** Starts the last line of a streamed chat answer that failed part-way */
export const AI_STREAM_ERROR_MARKER = '\u0000ERROR:'

export const AiFormRequestSchema = z.object({
  instructions: z.string().trim().max(4000).optional().nullable(),
})

// ---------------------------------------------------------------------------------------------------------------
// Company chat (mficrm-bwv.2) and saved prompts (mficrm-bwv.3)

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  at: string
  user_id?: number | null
  username?: string | null
  /** Why an answer is missing or incomplete (e.g. "Stopped") */
  error?: string
}

export const ChatAskSchema = z.object({
  chat_id: z.number().int().positive().optional().nullable(),
  text: z.string().trim().min(1, 'Type a question').max(8000),
})

/** Conversation titles: the first question, shortened */
export function chatTitle(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim()
  return flat.length > 60 ? `${flat.slice(0, 57)}…` : flat
}

export const PROMPT_PLACEHOLDERS = ['company', 'asking_price', 'revenue', 'profit', 'platform'] as const

export const PromptsSchema = z.object({
  prompts: z.array(z.object({
    name: z.string().trim().min(1, 'Every prompt needs a name').max(60),
    text: z.string().trim().min(1, 'Every prompt needs text').max(4000),
  })).max(50),
})

export const DEFAULT_PROMPTS: { name: string, text: string }[] = [
  { name: 'Summarise', text: 'Summarise {{company}}: what it does, how it makes money, how big it is and how long it has been running.' },
  { name: 'Valuation check', text: 'Is the asking price of {{asking_price}} reasonable for the profit shown? Give the multiple and show how you worked it out.' },
  { name: 'Revenue and profit trend', text: 'How have revenue and profit trended over the period the P&L covers? Point out any unusual months.' },
  { name: 'Expenses', text: 'What are the biggest expense lines, and which could be cut or improved after the acquisition?' },
  { name: 'Risks and red flags', text: 'What are the main risks and red flags for a buyer of {{company}}?' },
  { name: 'Questions for the seller', text: 'List the questions I should ask the seller before making an offer, most important first.' },
  { name: 'Check my notes', text: 'Check my notes against the documents: is anything wrong, missing or inconsistent?' },
]
