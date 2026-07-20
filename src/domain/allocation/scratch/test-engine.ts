// =============================================================================
// Scratch Test — AllocationEngine
// =============================================================================
// Run with:  npx tsx src/domain/allocation/scratch/test-engine.ts
//
// No database. No mocking framework. Pure function calls.
// Covers all 5 decision paths:
//   ✓ EMERGENCY — most senior with expertise; fallback to any-expertise
//   ✓ REPEAT_MATTER → ALLOCATED (prior counsel has capacity)
//   ✓ REPEAT_MATTER → REPEAT_MATTER_FALLBACK (prior counsel at capacity)
//   ✓ URGENT → ALLOCATED (seniority-first)
//   ✓ ROUTINE → ALLOCATED (least-loaded, expertise match)
//   ✓ QUEUED → nobody has capacity
// =============================================================================

import { AllocationEngine } from '../engine'
import type { BriefInput, StaffCandidate } from '../types'
import { ExpertiseArea, SeniorityLevel, UrgencyLevel } from '@prisma/client'

const engine = new AllocationEngine()

// ── Shared candidate fixtures ──────────────────────────────────────────────

const PETER: StaffCandidate = {
  id: 'staff-peter',
  seniority: SeniorityLevel.DEPUTY_CHIEF,
  isActive: true,
  expertiseAreas: [
    { area: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS, isPrimary: true },
    { area: ExpertiseArea.FINANCING_AGREEMENTS, isPrimary: false },
  ],
  hoursToday: 2.0,
  briefCountToday: 2,
}

const SHARON: StaffCandidate = {
  id: 'staff-sharon',
  seniority: SeniorityLevel.DEPUTY_CHIEF,
  isActive: true,
  expertiseAreas: [
    { area: ExpertiseArea.FINANCING_AGREEMENTS, isPrimary: true },
    { area: ExpertiseArea.PPP_PROJECT_AGREEMENTS, isPrimary: false },
  ],
  hoursToday: 1.0,
  briefCountToday: 1,
}

const ASHLEY: StaffCandidate = {
  id: 'staff-ashley',
  seniority: SeniorityLevel.PRINCIPAL,
  isActive: true,
  expertiseAreas: [
    { area: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS, isPrimary: true },
    { area: ExpertiseArea.GENERAL_LEGAL_ADVISORY, isPrimary: false },
  ],
  hoursToday: 4.0,
  briefCountToday: 3,
}

const ANGELA: StaffCandidate = {
  id: 'staff-angela',
  seniority: SeniorityLevel.SENIOR,
  isActive: true,
  expertiseAreas: [
    { area: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS, isPrimary: true },
  ],
  hoursToday: 7.5,   // Only 0.5 h left — cannot take a 1h brief
  briefCountToday: 7,
}

/** A candidate who is completely full */
const FULL_PETER: StaffCandidate = { ...PETER, hoursToday: 8.0 }
const FULL_SHARON: StaffCandidate = { ...SHARON, hoursToday: 8.0 }
const FULL_ASHLEY: StaffCandidate = { ...ASHLEY, hoursToday: 8.0 }
const FULL_ANGELA: StaffCandidate = { ...ANGELA, hoursToday: 8.0 }

// ── Helper ─────────────────────────────────────────────────────────────────

function run(label: string, brief: BriefInput, candidates: StaffCandidate[]) {
  const result = engine.allocate(brief, candidates)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`TEST: ${label}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(JSON.stringify(result, null, 2))
}

// =============================================================================
// TESTS
// =============================================================================

// ── Test 1: EMERGENCY — picks most senior with expertise ───────────────────
run(
  'EMERGENCY → ALLOCATED (expertise match, most senior)',
  {
    id: 'brief-001',
    urgency: UrgencyLevel.EMERGENCY,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 1.0,
    isRepeatMatter: false,
    priorStaffId: null,
  },
  [PETER, SHARON, ASHLEY, ANGELA],
)
// Expected: ALLOCATED to PETER (DEPUTY_CHIEF, has expertise, 2h today < 8h)

// ── Test 2: EMERGENCY — no expertise match, falls back to any-expertise ────
run(
  'EMERGENCY → ALLOCATED (any-expertise fallback)',
  {
    id: 'brief-002',
    urgency: UrgencyLevel.EMERGENCY,
    expertiseArea: ExpertiseArea.CABINET_MEMORANDA, // nobody has this expertise
    estimatedHours: 1.0,
    isRepeatMatter: false,
    priorStaffId: null,
  },
  [PETER, SHARON, ASHLEY, ANGELA],
)
// Expected: ALLOCATED to PETER or SHARON (most senior, any expertise)

// ── Test 3: EMERGENCY — all at capacity → QUEUED ─────────────────────────
run(
  'EMERGENCY → QUEUED (all at capacity)',
  {
    id: 'brief-003',
    urgency: UrgencyLevel.EMERGENCY,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 1.0,
    isRepeatMatter: false,
    priorStaffId: null,
  },
  [FULL_PETER, FULL_SHARON, FULL_ASHLEY, FULL_ANGELA],
)
// Expected: QUEUED

// ── Test 4: REPEAT_MATTER — prior counsel has capacity → ALLOCATED ─────────
run(
  'REPEAT_MATTER → ALLOCATED (prior counsel has capacity)',
  {
    id: 'brief-004',
    urgency: UrgencyLevel.ROUTINE,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 2.0,
    isRepeatMatter: true,
    priorStaffId: 'staff-peter',
  },
  [PETER, SHARON, ASHLEY, ANGELA],
)
// Expected: ALLOCATED to PETER (AUTO_REPEAT_MATTER)

// ── Test 5: REPEAT_MATTER — prior counsel at capacity → FALLBACK ───────────
run(
  'REPEAT_MATTER → REPEAT_MATTER_FALLBACK (prior counsel full)',
  {
    id: 'brief-005',
    urgency: UrgencyLevel.ROUTINE,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 2.0,
    isRepeatMatter: true,
    priorStaffId: 'staff-peter',
  },
  [FULL_PETER, SHARON, ASHLEY, ANGELA], // Peter is full
)
// Expected: REPEAT_MATTER_FALLBACK with priorStaffId=staff-peter

// ── Test 6: URGENT — seniority-first within expertise ─────────────────────
run(
  'URGENT → ALLOCATED (most senior with expertise and capacity)',
  {
    id: 'brief-006',
    urgency: UrgencyLevel.URGENT,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 1.0,
    isRepeatMatter: false,
    priorStaffId: null,
  },
  [PETER, ASHLEY, ANGELA],
)
// Expected: ALLOCATED to PETER (most senior with expertise + capacity)

// ── Test 7: ROUTINE — least-loaded with expertise ─────────────────────────
run(
  'ROUTINE → ALLOCATED (least-loaded with expertise)',
  {
    id: 'brief-007',
    urgency: UrgencyLevel.ROUTINE,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 1.0,
    isRepeatMatter: false,
    priorStaffId: null,
  },
  [PETER, ASHLEY, ANGELA], // Peter 2h, Ashley 4h, Angela 7.5h
)
// Expected: ALLOCATED to PETER (least loaded among expertise pool)

// ── Test 8: ROUTINE — all at capacity → QUEUED ────────────────────────────
run(
  'ROUTINE → QUEUED (all expertise-matching candidates at capacity)',
  {
    id: 'brief-008',
    urgency: UrgencyLevel.ROUTINE,
    expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    estimatedHours: 1.0,
    isRepeatMatter: false,
    priorStaffId: null,
  },
  [FULL_PETER, FULL_ASHLEY, FULL_ANGELA, SHARON], // Sharon has capacity but wrong expertise
)
// Expected: QUEUED (Sharon doesn't have PUBLIC_PROCUREMENT_CONTRACTS)

console.log(`\n${'═'.repeat(60)}`)
console.log('All tests complete.')
console.log(`${'═'.repeat(60)}\n`)
