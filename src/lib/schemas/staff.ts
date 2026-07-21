import { z } from 'zod'
import { SeniorityLevel, ExpertiseArea } from '@prisma/client'

const seniorityEnum = Object.values(SeniorityLevel) as [SeniorityLevel, ...SeniorityLevel[]]
const expertiseAreaEnum = Object.values(ExpertiseArea) as [ExpertiseArea, ...ExpertiseArea[]]

export const CreateStaffSchema = z.object({
  fullName: z.string()
    .min(3, 'Full name must be at least 3 characters')
    .max(100, 'Full name must be at most 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Full name may only contain letters, spaces, hyphens, and apostrophes'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .regex(/@ag\.go\.ke$/, 'Email must be @ag.go.ke'),
  designation: z.string().min(1, 'Designation is required').max(200),
  seniority: z.enum(seniorityEnum),
  primaryExpertise: z.enum(expertiseAreaEnum),
  additionalExpertise: z.array(z.enum(expertiseAreaEnum)).max(5).default([]),
  dateJoined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date joined must be in YYYY-MM-DD format'),
  employeeNumber: z
    .string()
    .min(1, 'Employee number is required')
    .regex(/^GTD-\d{3}$/, 'Employee number must be in format GTD-XXX'),
})

export type CreateStaffInput = z.infer<typeof CreateStaffSchema>

export const UpdateStaffSchema = z.object({
  fullName: z.string()
    .min(3, 'Full name must be at least 3 characters')
    .max(100, 'Full name must be at most 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Full name may only contain letters, spaces, hyphens, and apostrophes')
    .optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .regex(/@ag\.go\.ke$/, 'Email must be @ag.go.ke')
    .optional(),
  designation: z.string().min(1, 'Designation is required').max(200).optional(),
  seniority: z.enum(seniorityEnum).optional(),
  isActive: z.boolean().optional(),
  expertiseAreas: z
    .object({
      primary: z.enum(expertiseAreaEnum),
      secondary: z.array(z.enum(expertiseAreaEnum)).max(5).optional(),
    })
    .optional(),
})

export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>
