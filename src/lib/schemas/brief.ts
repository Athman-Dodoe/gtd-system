import { z } from 'zod'
import { ExpertiseArea, BriefSubType, UrgencyLevel } from '@prisma/client'

const expertiseAreaEnum = Object.values(ExpertiseArea) as [ExpertiseArea, ...ExpertiseArea[]]
const briefSubTypeEnum = Object.values(BriefSubType) as [BriefSubType, ...BriefSubType[]]
const urgencyLevelEnum = Object.values(UrgencyLevel) as [UrgencyLevel, ...UrgencyLevel[]]

export const CreateBriefSchema = z.object({
  subject: z.string().min(10, 'Subject must be at least 10 characters').max(500),
  description: z.string().max(2000).optional(),
  submittingEntity: z.string().max(200).optional(),
  expertiseArea: z.enum(expertiseAreaEnum),
  subType: z.enum(briefSubTypeEnum).default('STANDARD'),
  urgency: z.enum(urgencyLevelEnum).default('ROUTINE'),
  dueDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be in YYYY-MM-DD format')
    .optional(),
  estimatedHours: z.number().min(0.5).max(8).default(1.0),
  isRepeatMatter: z.boolean().default(false),
  parentBriefId: z.string().uuid().optional(),
})

export type CreateBriefInput = z.infer<typeof CreateBriefSchema>

export const UpdateBriefSchema = z.object({
  referenceNumber: z.string().regex(/^GTD\/\d{4}\/\d+$/, 'referenceNumber must match GTD/YYYY/N').optional(),
  subject: z.string().min(10, 'Subject must be at least 10 characters').max(500).optional(),
  description: z.string().max(2000).optional(),
  submittingEntity: z.string().max(200).optional().nullable(),
  expertiseArea: z.enum(expertiseAreaEnum).optional(),
  subType: z.enum(briefSubTypeEnum).optional(),
  urgency: z.enum(urgencyLevelEnum).optional(),
  dueDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  estimatedHours: z.number().min(0.5).max(8).optional(),
  isRepeatMatter: z.boolean().optional(),
  parentBriefId: z.string().uuid().optional().nullable(),
})

export type UpdateBriefInput = z.infer<typeof UpdateBriefSchema>
