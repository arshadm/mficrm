import { z } from 'zod'

export const BusinessCategoryEnum = z.enum([
  'fba', 'saas', 'ios', 'android', 'content',
  'ecommerce', 'agency', 'marketplace', 'newsletter', 'other'
])

export const BusinessStageEnum = z.enum([
  'initial_interest', 'qualified', 'rejected', 'seller_engaged',
  'offer_made', 'offer_accepted', 'offer_rejected'
])

export const InteractionTypeEnum = z.enum([
  'note', 'email', 'call', 'meeting', 'document', 'stage_change', 'offer', 'other'
])

export const CreateBusinessSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  category: BusinessCategoryEnum,
  stage: BusinessStageEnum.default('initial_interest'),
  description: z.string().optional().nullable(),
  listing_url: z.string().url().optional().nullable().or(z.literal('')),
  asking_price: z.number().positive().optional().nullable(),
  trailing_12m_revenue: z.number().positive().optional().nullable(),
  trailing_12m_profit: z.number().optional().nullable(),
  platform: z.string().optional().nullable(),
  date_listed: z.string().optional().nullable(),
  assigned_to: z.number().int().positive().optional().nullable(),
  follow_up_date: z.string().optional().nullable(),
  follow_up_note: z.string().optional().nullable(),
})

export const UpdateBusinessSchema = CreateBusinessSchema.partial()

export const BusinessCaseSchema = z.object({
  strategic_rationale: z.string().optional().nullable(),
  target_market: z.string().optional().nullable(),
  competitive_advantage: z.string().optional().nullable(),
  key_risks: z.string().optional().nullable(),
  assumptions: z.string().optional().nullable(),
})

export const GrowthPlanSchema = z.object({
  year1_goals: z.string().optional().nullable(),
  year2_goals: z.string().optional().nullable(),
  marketing_strategy: z.string().optional().nullable(),
  product_roadmap: z.string().optional().nullable(),
  team_requirements: z.string().optional().nullable(),
})

export const WorkingCapitalSchema = z.object({
  acquisition_cost: z.number().optional().nullable(),
  legal_fees: z.number().optional().nullable(),
  transition_costs: z.number().optional().nullable(),
  initial_marketing_budget: z.number().optional().nullable(),
  tech_infrastructure: z.number().optional().nullable(),
  working_capital_buffer: z.number().optional().nullable(),
  other_costs: z.number().optional().nullable(),
  other_costs_notes: z.string().optional().nullable(),
  funding_source: z.string().optional().nullable(),
})

export const RiskItemSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1, 'Description is required'),
  is_resolved: z.boolean().default(false),
  resolved_note: z.string().optional().nullable(),
})

export const ValuationSchema = z.object({
  valuation_method: z.string().optional().nullable(),
  estimated_value_low: z.number().optional().nullable(),
  estimated_value_mid: z.number().optional().nullable(),
  estimated_value_high: z.number().optional().nullable(),
  initial_offer: z.number().optional().nullable(),
  max_offer: z.number().optional().nullable(),
  final_offer_made: z.number().optional().nullable(),
  offer_notes: z.string().optional().nullable(),
})

export const CreateInteractionSchema = z.object({
  type: InteractionTypeEnum,
  title: z.string().optional().nullable(),
  body: z.string().optional().nullable(),
  occurred_at: z.string().optional(),
})

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export const CreateUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  email: z.string().email().optional().nullable(),
  role: z.enum(['admin', 'user']).default('user'),
})
