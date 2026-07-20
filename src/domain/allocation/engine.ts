// =============================================================================
// AllocationEngine — Pure Domain Service
// =============================================================================
// ⚠️  This file MUST NOT import from: @prisma/client (runtime values),
//     next, node:*, or any infrastructure module.
//     It imports ONLY from:
//       • @prisma/client  — enum TYPES only (erased at runtime, zero cost)
//       • @/lib/constants — plain numeric constants
//       • ./types         — plain TypeScript interfaces
//
// This class is a "functional core": given the same inputs it always produces
// the same output and touches nothing external. Every branch is unit-testable
// with zero database setup.
// =============================================================================

import { AllocationMethod, SeniorityLevel } from '@prisma/client'
import { DAILY_CAPACITY_HOURS } from '@/lib/constants'
import type { AllocationResult, BriefInput, StaffCandidate } from './types'

// -----------------------------------------------------------------------------
// Seniority rank map — higher number = more senior = preferred for URGENT/EMERGENCY
// -----------------------------------------------------------------------------

const SENIORITY_RANK: Record<SeniorityLevel, number> = {
  [SeniorityLevel.DEPUTY_CHIEF]: 3,
  [SeniorityLevel.PRINCIPAL]: 2,
  [SeniorityLevel.SENIOR]: 1,
}

// =============================================================================
// ENGINE CLASS
// =============================================================================

export class AllocationEngine {
  // ---------------------------------------------------------------------------
  // PUBLIC ENTRY POINT
  // ---------------------------------------------------------------------------

  /**
   * Decide which counsel should receive the given brief.
   *
   * Runs the 5-step decision flow in order. The first step that produces a
   * result terminates the chain — no later steps are evaluated.
   *
   * @param brief      - The incoming brief (plain object, no Prisma types)
   * @param candidates - Active staff members with their workload for today
   * @returns          AllocationResult (discriminated union)
   */
  allocate(brief: BriefInput, candidates: StaffCandidate[]): AllocationResult {
    const active = candidates.filter((c) => c.isActive)

    // Step 1 — EMERGENCY: most senior counsel with capacity (expertise-aware)
    if (brief.urgency === 'EMERGENCY') {
      const result = this.step1_emergency(brief, active)
      if (result) return result
      // If no one has capacity at all, fall through to QUEUED
      return this.step5_queue('EMERGENCY brief: all active counsel are at capacity.')
    }

    // Step 2 — Repeat matter: route back to the prior handling counsel
    if (brief.isRepeatMatter && brief.priorStaffId !== null) {
      const result = this.step2_repeatMatter(brief, active)
      if (result) return result
      // step2 returns null only when prior counsel is at capacity (REPEAT_MATTER_FALLBACK
      // is returned directly by step2, not null) — so null here means prior counsel
      // not found in active pool at all; continue to normal routing below.
    }

    // Step 3 — URGENT: seniority-first within matching expertise
    if (brief.urgency === 'URGENT') {
      const result = this.step3_urgent(brief, active)
      if (result) return result
      // No capacity found in expertise pool — queue
      return this.step5_queue(
        `URGENT brief: no active counsel with expertise in ${brief.expertiseArea} has remaining capacity.`,
      )
    }

    // Step 4 — ROUTINE: least-loaded counsel with matching expertise
    const result = this.step4_routineExpertise(brief, active)
    if (result) return result

    // Step 5 — Fallback: nobody available
    return this.step5_queue(
      `No active counsel with expertise in ${brief.expertiseArea} has remaining capacity.`,
    )
  }

  // ---------------------------------------------------------------------------
  // PRIVATE STEPS
  // ---------------------------------------------------------------------------

  /**
   * Step 1 — EMERGENCY routing.
   *
   * Strategy:
   *   1. Try to find the most senior counsel who ALSO matches the expertise area.
   *   2. If nobody with matching expertise has capacity, fall back to any active
   *      counsel sorted by seniority (expertise ignored).
   *
   * Returns null only when the active list is empty or everyone is at capacity
   * (caller then returns QUEUED).
   */
  private step1_emergency(brief: BriefInput, active: StaffCandidate[]): AllocationResult | null {
    // Phase A: expertise-matched, seniority-sorted
    const expertiseMatch = active.filter((c) => this.hasExpertise(c, brief.expertiseArea))
    const bySeniority = this.sortBySeniority(expertiseMatch)
    const withCapacity = bySeniority.find((c) => this.hasCapacity(c, brief.estimatedHours))

    if (withCapacity) {
      return {
        outcome: 'ALLOCATED',
        staffId: withCapacity.id,
        method: AllocationMethod.AUTO_SENIORITY,
        reason:
          `EMERGENCY: allocated to most senior available counsel with ${brief.expertiseArea} expertise — ` +
          `staffId=${withCapacity.id}, seniority=${withCapacity.seniority}, ` +
          `hoursToday=${withCapacity.hoursToday}.`,
      }
    }

    // Phase B: any-expertise fallback (expertise constraint relaxed for emergencies)
    const anyExpertise = this.sortBySeniority(active)
    const anyWithCapacity = anyExpertise.find((c) => this.hasCapacity(c, brief.estimatedHours))

    if (anyWithCapacity) {
      return {
        outcome: 'ALLOCATED',
        staffId: anyWithCapacity.id,
        method: AllocationMethod.AUTO_SENIORITY,
        reason:
          `EMERGENCY (expertise fallback): no ${brief.expertiseArea} specialist available. ` +
          `Allocated to most senior counsel with capacity — staffId=${anyWithCapacity.id}, ` +
          `seniority=${anyWithCapacity.seniority}, hoursToday=${anyWithCapacity.hoursToday}.`,
      }
    }

    return null // Caller will QUEUE
  }

  /**
   * Step 2 — Repeat matter routing.
   *
   * If the brief is flagged as a repeat matter AND a prior counsel is identified:
   *   - Prior counsel has capacity → ALLOCATED (AUTO_REPEAT_MATTER)
   *   - Prior counsel is at capacity → REPEAT_MATTER_FALLBACK (DSG alert)
   *   - Prior counsel is not in the active pool → return null (continue to step 3/4)
   */
  private step2_repeatMatter(
    brief: BriefInput,
    active: StaffCandidate[],
  ): AllocationResult | null {
    const priorCounsel = active.find((c) => c.id === brief.priorStaffId)

    if (!priorCounsel) {
      // Prior counsel is deactivated or not in the candidate pool. Continue
      // to normal routing — do not QUEUE solely because of the repeat-matter flag.
      return null
    }

    if (this.hasCapacity(priorCounsel, brief.estimatedHours)) {
      return {
        outcome: 'ALLOCATED',
        staffId: priorCounsel.id,
        method: AllocationMethod.AUTO_REPEAT_MATTER,
        reason:
          `Repeat matter: routed back to prior handling counsel (staffId=${priorCounsel.id}) ` +
          `who handled the parent brief. hoursToday=${priorCounsel.hoursToday}.`,
      }
    }

    // Prior counsel exists but is at capacity — special DSG alert path
    return {
      outcome: 'REPEAT_MATTER_FALLBACK',
      priorStaffId: brief.priorStaffId!,
      reason:
        `Repeat matter: prior counsel (staffId=${brief.priorStaffId}) is at capacity ` +
        `(hoursToday=${priorCounsel.hoursToday}). DSG must manually assign.`,
    }
  }

  /**
   * Step 3 — URGENT routing.
   *
   * Filters to candidates with matching expertise, sorts by seniority DESC
   * (tiebreak: hoursToday ASC), returns first with capacity.
   */
  private step3_urgent(brief: BriefInput, active: StaffCandidate[]): AllocationResult | null {
    const expertisePool = active.filter((c) => this.hasExpertise(c, brief.expertiseArea))
    const sorted = this.sortBySeniority(expertisePool)
    const pick = sorted.find((c) => this.hasCapacity(c, brief.estimatedHours))

    if (!pick) return null

    return {
      outcome: 'ALLOCATED',
      staffId: pick.id,
      method: AllocationMethod.AUTO_SENIORITY,
      reason:
        `URGENT: allocated to most senior available counsel with ${brief.expertiseArea} expertise — ` +
        `staffId=${pick.id}, seniority=${pick.seniority}, hoursToday=${pick.hoursToday}.`,
    }
  }

  /**
   * Step 4 — ROUTINE expertise-match routing.
   *
   * Filters to candidates with matching expertise, sorts by hoursToday ASC
   * (least loaded first). Tiebreak: isPrimary expertise DESC (domain specialists
   * preferred over generalists who picked up a secondary area).
   */
  private step4_routineExpertise(
    brief: BriefInput,
    active: StaffCandidate[],
  ): AllocationResult | null {
    const expertisePool = active.filter((c) => this.hasExpertise(c, brief.expertiseArea))
    const sorted = this.sortByLoad(expertisePool, brief.expertiseArea)
    const pick = sorted.find((c) => this.hasCapacity(c, brief.estimatedHours))

    if (!pick) return null

    const isPrimaryMatch = pick.expertiseAreas.some(
      (e) => e.area === brief.expertiseArea && e.isPrimary,
    )

    return {
      outcome: 'ALLOCATED',
      staffId: pick.id,
      method: AllocationMethod.AUTO_EXPERTISE,
      reason:
        `ROUTINE: allocated to least-loaded counsel with ${brief.expertiseArea} expertise — ` +
        `staffId=${pick.id}, isPrimaryExpertise=${isPrimaryMatch}, ` +
        `hoursToday=${pick.hoursToday}.`,
    }
  }

  /**
   * Step 5 — Queue fallback.
   *
   * Always returns QUEUED. Called when all earlier steps fail to find a
   * suitable counsel with remaining capacity.
   */
  private step5_queue(reason: string): AllocationResult {
    return { outcome: 'QUEUED', reason }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the candidate's already-allocated hours plus the
   * brief's estimated hours stays within the daily capacity ceiling.
   */
  private hasCapacity(candidate: StaffCandidate, estimatedHours: number): boolean {
    return candidate.hoursToday + estimatedHours <= DAILY_CAPACITY_HOURS
  }

  /**
   * Returns true if the candidate has the given expertise area in their profile
   * (primary OR secondary).
   */
  private hasExpertise(candidate: StaffCandidate, area: string): boolean {
    return candidate.expertiseAreas.some((e) => e.area === area)
  }

  /**
   * Sorts candidates by seniority DESC (DEPUTY_CHIEF → PRINCIPAL → SENIOR).
   * Tie-break: hoursToday ASC (least loaded wins among equals).
   * Returns a new array; does not mutate the input.
   */
  private sortBySeniority(candidates: StaffCandidate[]): StaffCandidate[] {
    return [...candidates].sort((a, b) => {
      const seniorityDiff = SENIORITY_RANK[b.seniority] - SENIORITY_RANK[a.seniority]
      if (seniorityDiff !== 0) return seniorityDiff
      return a.hoursToday - b.hoursToday // tie-break: less loaded first
    })
  }

  /**
   * Sorts candidates by workload ASC (least loaded first).
   * Tie-break: isPrimary DESC for the requested expertise area (specialists
   * preferred over those who only hold it as a secondary area).
   * Returns a new array; does not mutate the input.
   */
  private sortByLoad(candidates: StaffCandidate[], area: string): StaffCandidate[] {
    return [...candidates].sort((a, b) => {
      const loadDiff = a.hoursToday - b.hoursToday
      if (loadDiff !== 0) return loadDiff
      // Tie-break: primary expertise preferred
      const aPrimary = a.expertiseAreas.some((e) => e.area === area && e.isPrimary) ? 1 : 0
      const bPrimary = b.expertiseAreas.some((e) => e.area === area && e.isPrimary) ? 1 : 0
      return bPrimary - aPrimary // higher primary score first
    })
  }
}
