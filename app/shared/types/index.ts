export type BusinessCategory =
  | 'fba' | 'saas' | 'ios' | 'android' | 'content'
  | 'ecommerce' | 'agency' | 'marketplace' | 'newsletter' | 'other'

export type BusinessStage =
  | 'initial_interest' | 'qualified' | 'rejected' | 'seller_engaged'
  | 'offer_made' | 'offer_accepted' | 'offer_rejected'

export type InteractionType =
  | 'note' | 'email' | 'call' | 'meeting' | 'document' | 'stage_change' | 'offer' | 'other' | 'form_submission'

export type UserRole = 'admin' | 'user'

export interface User {
  id: number
  username: string
  email: string | null
  role: UserRole
  created_at: string
}

export interface Business {
  id: number
  name: string
  category: BusinessCategory
  stage: BusinessStage
  description: string | null
  listing_url: string | null
  asking_price: number | null
  revenue_multiple: number | null
  trailing_12m_revenue: number | null
  trailing_12m_profit: number | null
  platform: string | null
  date_listed: string | null
  date_added: string
  last_updated: string
  assigned_to: number | null
  assigned_user?: User | null
  follow_up_date: string | null
  follow_up_note: string | null
  is_archived: number
}

export interface BusinessCase {
  id: number
  business_id: number
  strategic_rationale: string | null
  target_market: string | null
  competitive_advantage: string | null
  key_risks: string | null
  assumptions: string | null
  updated_at: string
}

export interface GrowthPlan {
  id: number
  business_id: number
  year1_goals: string | null
  year2_goals: string | null
  marketing_strategy: string | null
  product_roadmap: string | null
  team_requirements: string | null
  updated_at: string
}

export interface WorkingCapital {
  id: number
  business_id: number
  acquisition_cost: number | null
  legal_fees: number | null
  transition_costs: number | null
  initial_marketing_budget: number | null
  tech_infrastructure: number | null
  working_capital_buffer: number | null
  other_costs: number | null
  other_costs_notes: string | null
  total_estimated: number | null
  funding_source: string | null
  updated_at: string
}

export interface RiskItem {
  id: number
  business_id: number
  category: string
  description: string
  is_resolved: number
  resolved_note: string | null
  created_at: string
}

export interface Valuation {
  id: number
  business_id: number
  valuation_method: string | null
  estimated_value_low: number | null
  estimated_value_mid: number | null
  estimated_value_high: number | null
  initial_offer: number | null
  max_offer: number | null
  final_offer_made: number | null
  offer_notes: string | null
  updated_at: string
}

export interface Interaction {
  id: number
  business_id: number
  user_id: number | null
  user?: User | null
  type: InteractionType
  title: string | null
  body: string | null
  occurred_at: string
  created_at: string
  attachments?: Attachment[]
}

export interface Attachment {
  id: number
  interaction_id: number | null
  business_id: number | null
  filename: string
  original_name: string
  mime_type: string | null
  file_size: number | null
  uploaded_at: string
}

export const STAGE_LABELS: Record<BusinessStage, string> = {
  initial_interest: 'Initial Interest',
  qualified: 'Qualified',
  rejected: 'Rejected',
  seller_engaged: 'Seller Engaged',
  offer_made: 'Offer Made',
  offer_accepted: 'Offer Accepted',
  offer_rejected: 'Offer Rejected',
}

export const STAGE_COLORS: Record<BusinessStage, string> = {
  initial_interest: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-800 dark:text-indigo-300',
  qualified: 'bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300',
  rejected: 'bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300',
  seller_engaged: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300',
  offer_made: 'bg-purple-100 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300',
  offer_accepted: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  offer_rejected: 'bg-rose-100 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300',
}

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  fba: 'Amazon FBA',
  saas: 'SaaS',
  ios: 'iOS App',
  android: 'Android App',
  content: 'Content',
  ecommerce: 'eCommerce',
  agency: 'Agency',
  marketplace: 'Marketplace',
  newsletter: 'Newsletter',
  other: 'Other',
}

export const STAGE_ORDER: BusinessStage[] = [
  'initial_interest', 'qualified', 'rejected', 'seller_engaged',
  'offer_made', 'offer_accepted', 'offer_rejected'
]

export type NextStepStatus = 'pending' | 'done' | 'skipped'

export interface NextStep {
  id: number
  business_id: number
  title: string
  notes: string | null
  due_date: string
  is_primary: number
  parent_id: number | null
  status: NextStepStatus
  completion_note: string | null
  completed_at: string | null
  completed_by: number | null
  completed_by_username?: string | null
  created_by: number | null
  created_by_username?: string | null
  created_at: string
  updated_at: string
}

export interface NextStepsData {
  primary: NextStep | null
  subtasks: NextStep[]
  history: NextStep[]
}

export interface CalendarEntry {
  step_id: number
  step_title: string
  step_notes: string | null
  due_date: string
  business_id: number
  business_name: string
  business_category: string
  is_overdue: boolean
}

export type CalendarData = Record<string, CalendarEntry[]>

export interface TodayAction {
  step_id: number
  step_title: string
  step_notes: string | null
  due_date: string
  status: NextStepStatus
  business_id: number
  business_name: string
  business_category: string
}
