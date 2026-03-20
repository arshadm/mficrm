import { z } from 'zod'

export const CreateNextStepSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  notes: z.string().optional().nullable(),
  due_date: z.string().min(1, 'Due date is required'),
})

export const UpdateNextStepSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  due_date: z.string().optional(),
})

export const CompleteNextStepSchema = z.object({
  completion_note: z.string().optional(),
})

export const CreateSubtaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  due_date: z.string().optional().nullable(),
})
