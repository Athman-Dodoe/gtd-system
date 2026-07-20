import { ExpertiseArea } from '@prisma/client'

export const DAILY_CAPACITY_HOURS = 8.0
export const WORKING_HOURS_PER_DAY = 7.0
/** Secondary guardrail: max briefs per staff member per day. Not enforced in engine v1. */
export const MAX_BRIEFS_PER_DAY = 10

export const EXPERTISE_LABELS: Record<ExpertiseArea, string> = {
  [ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS]: 'Public Procurement Contracts (Clearance & Termination)',
  [ExpertiseArea.FINANCING_AGREEMENTS]: 'Financing Agreements (Clearance & Legal Opinions)',
  [ExpertiseArea.PPP_PROJECT_AGREEMENTS]: 'Public Private Partnership Project Agreements',
  [ExpertiseArea.MEMORANDA_OF_UNDERSTANDING]: 'Memoranda of Understanding',
  [ExpertiseArea.CABINET_MEMORANDA]: 'Cabinet Memoranda',
  [ExpertiseArea.GENERAL_LEGAL_ADVISORY]: 'General Legal Advisory',
}
