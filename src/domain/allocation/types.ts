// =============================================================================
// Allocation Engine — Domain Types
// =============================================================================
// Plain TypeScript only. Zero imports from @prisma/client, next, or any Node.js
// infrastructure. The service layer maps Prisma records → these types before
// calling the engine, keeping the engine infrastructure-agnostic.
// =============================================================================

import type { AllocationMethod, ExpertiseArea, SeniorityLevel, UrgencyLevel } from '@prisma/client'

// -----------------------------------------------------------------------------
// INPUT TYPES — passed INTO the engine by AllocationService
// -----------------------------------------------------------------------------

/**
 * A stripped-down view of a Brief containing only the fields the engine needs
 * to make its allocation decision. Decimal fields (estimatedHours) are already
 * converted to plain `number` by the service before passing in.
 */
export interface BriefInput {
  id: string
  urgency: UrgencyLevel
  expertiseArea: ExpertiseArea
  /** Converted from Prisma `Decimal` to `number` by the service. */
  estimatedHours: number
  isRepeatMatter: boolean
  /**
   * The staffId of the counsel who handled the parent brief, if this is a
   * repeat matter. The service resolves this by looking up the parent brief's
   * active Allocation. `null` when isRepeatMatter is false, or when no active
   * allocation exists for the parent brief.
   */
  priorStaffId: string | null
}

/**
 * A single counsel candidate for allocation. Assembled by the service from
 * Staff + StaffExpertise + DailyWorkload records.
 */
export interface StaffCandidate {
  id: string
  seniority: SeniorityLevel
  expertiseAreas: StaffExpertiseEntry[]
  /**
   * Total hours already allocated to this staff member today.
   * Sourced from DailyWorkload.hoursAllocated. Defaults to 0 if no
   * DailyWorkload row exists for today yet.
   */
  hoursToday: number
  /**
   * Number of briefs already allocated to this staff member today.
   * Sourced from DailyWorkload.briefCount. Defaults to 0 if no row exists.
   */
  briefCountToday: number
  isActive: boolean
}

/** One entry in a counsel's expertise profile. */
export interface StaffExpertiseEntry {
  area: ExpertiseArea
  /** True for the counsel's main specialisation — used as a tie-breaker. */
  isPrimary: boolean
}

// -----------------------------------------------------------------------------
// OUTPUT TYPE — returned FROM the engine
// -----------------------------------------------------------------------------

/**
 * Discriminated union of every possible allocation outcome. The `outcome` field
 * is the discriminant — use it in a switch/if to narrow to the correct shape.
 *
 * ALLOCATED             → a counsel was found; create an Allocation row
 * QUEUED                → no counsel had capacity; put brief in AllocationQueue
 * REPEAT_MATTER_FALLBACK→ repeat matter but prior counsel is at capacity;
 *                         queue the brief and send a special DSG alert
 */
export type AllocationResult =
  | {
      outcome: 'ALLOCATED'
      staffId: string
      method: AllocationMethod
      /** Human-readable explanation written to AuditLog.payload. */
      reason: string
    }
  | {
      outcome: 'QUEUED'
      /** Human-readable explanation written to AuditLog.payload and AllocationQueue.queuedReason. */
      reason: string
    }
  | {
      outcome: 'REPEAT_MATTER_FALLBACK'
      /** The staffId who previously handled the parent brief. Used in the DSG alert. */
      priorStaffId: string
      /** Human-readable explanation. */
      reason: string
    }
