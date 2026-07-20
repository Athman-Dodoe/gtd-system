// =============================================================================
// Scratch Test — Queue API (Manual Assign + Withdraw)
// =============================================================================
// Run with:  npx tsx src/scratch/test-queue-api.ts
//
// Requires an existing database with seed data loaded (npm run db:seed).
// Uses Prisma directly — no HTTP server needed.
//
// Test flow:
//   1. Fetches seed DSG user + counsel from the database
//   2. Creates a brief, maxes out counsel workload, runs allocation → QUEUED
//   3. Verifies queue entry exists and brief status is QUEUED
//   4. Calls manuallyAssignBrief() to allocate to an active counsel
//   5. Verifies Allocation, brief status ALLOCATED, queue resolved, workload updated
//   6. Creates a second queued brief, calls withdrawBrief()
//   7. Verifies brief status CLOSED, queue resolved
//   8. Verifies AuditLog entries for both operations
// =============================================================================

import 'dotenv/config'
import { prisma } from '../server/db'
import {
  manuallyAssignBrief,
  withdrawBrief,
} from '../server/services/queue.service'
import { runAllocation } from '../server/services/allocation.service'
import {
  BriefStatus,
  ExpertiseArea,
  BriefSubType,
  UrgencyLevel,
  AuditEventType,
} from '@prisma/client'
import { DAILY_CAPACITY_HOURS } from '../lib/constants'

// ── Helpers ────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures: string[] = []

function assert(label: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  ✅  ${label}`)
  } else {
    failed++
    failures.push(label)
    console.log(`  ❌  ${label}`)
  }
}

async function resetWorkloads(staffIds: string[]) {
  await prisma.dailyWorkload.deleteMany({
    where: { staffId: { in: staffIds } },
  })
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  Queue Service Integration Test')
  console.log('══════════════════════════════════════════════════════════════\n')

  // ── Step 0: Fetch seed entities ─────────────────────────────────────────
  console.log('── [0] Fetch seed entities ──────────────────────────────────')

  const dsgUser = await prisma.user.findUnique({
    where: { email: 'jacqueline.muindi@ag.go.ke' },
  })
  assert('DSG user found (jacqueline.muindi@ag.go.ke)', !!dsgUser)
  if (!dsgUser) {
    console.error('Seed data not found — run npm run db:seed first.')
    process.exit(1)
  }

  // Pick a counsel with PUBLIC_PROCUREMENT_CONTRACTS expertise
  const counsel = await prisma.staff.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      expertiseAreas: {
        some: {
          expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
          isPrimary: true,
        },
      },
    },
    include: { user: true },
  })
  assert('Active counsel found with PUBLIC_PROCUREMENT_CONTRACTS expertise', !!counsel)
  if (!counsel || !counsel.user) {
    console.error('No matching counsel found in seed data.')
    process.exit(1)
  }

  // Get all counsel IDs in the same expertise pool
  const counselPool = await prisma.staff.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      expertiseAreas: {
        some: {
          expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
        },
      },
    },
    select: { id: true },
  })
  const poolIds = counselPool.map((s) => s.id)
  console.log(`  ℹ️   Counsel pool size: ${poolIds.length}`)
  console.log(`  ℹ️   Target counsel: ${counsel.fullName} (${counsel.id})`)

  // ── Step 1: Set up queue scenario ──────────────────────────────────────
  console.log('\n── [1] Force queue scenario — max out counsel workloads ────')

  await resetWorkloads(poolIds)
  await prisma.dailyWorkload.createMany({
    data: poolIds.map((sid) => ({
      staffId: sid,
      workDate: new Date(),
      hoursAllocated: DAILY_CAPACITY_HOURS,
      briefCount: 5,
    })),
  })
  console.log('  ℹ️   All counsel workloads set to capacity limit')

  // ── Step 2: Create brief ───────────────────────────────────────────────
  console.log('\n── [2] Create brief and run allocation ─────────────────────')

  const brief = await prisma.brief.create({
    data: {
      referenceNumber: `TEST-QUEUE-${Date.now()}`,
      subject: 'Test brief for queue integration test',
      description: 'This brief should be queued — all counsels at capacity',
      submittingEntity: 'Test Ministry',
      expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
      subType: BriefSubType.STANDARD,
      urgency: UrgencyLevel.ROUTINE,
      estimatedHours: 2.0,
      isRepeatMatter: false,
      status: BriefStatus.RECEIVED,
      createdById: dsgUser.id,
    },
  })
  assert('Brief created with RECEIVED status', brief.status === BriefStatus.RECEIVED)

  const result = await runAllocation(brief.id, dsgUser.id)
  assert(`Allocation engine returned QUEUED outcome (got: ${result.outcome})`, result.outcome === 'QUEUED')

  // ── Step 3: Verify queue entry ─────────────────────────────────────────
  console.log('\n── [3] Verify queue entry exists ───────────────────────────')

  const queueItem = await prisma.allocationQueue.findUnique({
    where: { briefId: brief.id },
  })
  assert('Queue entry exists', !!queueItem)
  assert('Queue entry is unresolved (resolvedAt IS NULL)', queueItem?.resolvedAt === null)
  assert('Queue entry has a reason', !!queueItem?.queuedReason)

  const briefAfterQueue = await prisma.brief.findUnique({ where: { id: brief.id } })
  assert(`Brief status is QUEUED (got: ${briefAfterQueue?.status})`, briefAfterQueue?.status === BriefStatus.QUEUED)

  // ── Step 4: Manual assignment ──────────────────────────────────────────
  console.log('\n── [4] Manual assignment by DSG ────────────────────────────')

  const assignResult = await manuallyAssignBrief(
    brief.id,
    counsel.id,
    dsgUser.id,
    'Test manual assignment from queue',
  )
  assert('manuallyAssignBrief succeeded', assignResult.success)
  assert('allocationId returned', !!assignResult.allocationId)

  // ── Step 5: Verify assignment effects ──────────────────────────────────
  console.log('\n── [5] Verify assignment effects ───────────────────────────')

  const briefAfterAssign = await prisma.brief.findUnique({ where: { id: brief.id } })
  assert(`Brief status is ALLOCATED (got: ${briefAfterAssign?.status})`, briefAfterAssign?.status === BriefStatus.ALLOCATED)

  const queueAfterAssign = await prisma.allocationQueue.findUnique({ where: { briefId: brief.id } })
  assert('Queue entry is resolved (resolvedAt IS NOT NULL)', queueAfterAssign?.resolvedAt !== null)
  assert('Queue entry has resolvedById', queueAfterAssign?.resolvedById === dsgUser.id)

  const allocation = await prisma.allocation.findUnique({
    where: { id: assignResult.allocationId },
  })
  assert('Allocation record exists', !!allocation)
  assert(`Allocation method is MANUAL_DSG (got: ${allocation?.allocationMethod})`, allocation?.allocationMethod === 'MANUAL_DSG')
  assert('Allocation links to correct staffId', allocation?.staffId === counsel.id)
  assert('Allocation has hoursAllocated set', Number(allocation?.hoursAllocated ?? 0) > 0)

  const workloadToday = await prisma.dailyWorkload.findUnique({
    where: {
      staffId_workDate: { staffId: counsel.id, workDate: new Date() },
    },
  })
  assert('DailyWorkload exists for counsel', !!workloadToday)
  assert('DailyWorkload briefCount incremented', (workloadToday?.briefCount ?? 0) > 0)
  assert('DailyWorkload hoursAllocated incremented', Number(workloadToday?.hoursAllocated ?? 0) > DAILY_CAPACITY_HOURS)

  const auditAssign = await prisma.auditLog.findFirst({
    where: {
      briefId: brief.id,
      eventType: AuditEventType.MANUAL_ASSIGNMENT_BY_DSG,
    },
  })
  assert('AuditLog: MANUAL_ASSIGNMENT_BY_DSG created', !!auditAssign)
  assert('AuditLog: links to correct actor', auditAssign?.actorId === dsgUser.id)
  assert('AuditLog: links to correct staff', auditAssign?.staffId === counsel.id)
  assert('AuditLog: links to allocation', auditAssign?.allocationId === assignResult.allocationId)

  // ── Step 6: Withdraw test ──────────────────────────────────────────────
  console.log('\n── [6] Create second brief and withdraw ────────────────────')

  // Reset workloads back to capacity to force queue
  await resetWorkloads(poolIds)
  await prisma.dailyWorkload.createMany({
    data: poolIds.map((sid) => ({
      staffId: sid,
      workDate: new Date(),
      hoursAllocated: DAILY_CAPACITY_HOURS,
      briefCount: 5,
    })),
  })

  const brief2 = await prisma.brief.create({
    data: {
      referenceNumber: `TEST-QUEUE-WITHDRAW-${Date.now()}`,
      subject: 'Test brief for queue withdrawal',
      description: 'This brief will be withdrawn from the queue',
      submittingEntity: 'Test Ministry',
      expertiseArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
      subType: BriefSubType.LEGAL_OPINION,
      urgency: UrgencyLevel.URGENT,
      estimatedHours: 1.5,
      isRepeatMatter: false,
      status: BriefStatus.RECEIVED,
      createdById: dsgUser.id,
    },
  })
  assert('Second brief created', !!brief2.id)

  const result2 = await runAllocation(brief2.id, dsgUser.id)
  assert(`Allocation engine returned QUEUED (got: ${result2.outcome})`, result2.outcome === 'QUEUED')

  const queueItem2 = await prisma.allocationQueue.findUnique({
    where: { briefId: brief2.id },
  })
  assert('Queue entry exists for second brief', !!queueItem2)
  assert('Queue entry unresolved', queueItem2?.resolvedAt === null)

  await withdrawBrief(brief2.id, dsgUser.id, 'Test withdrawal from queue')
  assert('withdrawBrief succeeded', true)

  // ── Step 7: Verify withdrawal effects ──────────────────────────────────
  console.log('\n── [7] Verify withdrawal effects ───────────────────────────')

  const briefAfterWithdraw = await prisma.brief.findUnique({ where: { id: brief2.id } })
  assert(`Brief status is CLOSED (got: ${briefAfterWithdraw?.status})`, briefAfterWithdraw?.status === BriefStatus.CLOSED)

  const queueAfterWithdraw = await prisma.allocationQueue.findUnique({ where: { briefId: brief2.id } })
  assert('Queue entry resolved', queueAfterWithdraw?.resolvedAt !== null)
  assert('Queue entry has resolvedById', queueAfterWithdraw?.resolvedById === dsgUser.id)

  const auditWithdraw = await prisma.auditLog.findFirst({
    where: {
      briefId: brief2.id,
      eventType: AuditEventType.BRIEF_CLOSED,
    },
  })
  assert('AuditLog: BRIEF_CLOSED created', !!auditWithdraw)
  assert('AuditLog payload includes action QUEUE_WITHDRAWAL', (auditWithdraw?.payload as Record<string, unknown>)?.action === 'QUEUE_WITHDRAWAL')

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════')
  const total = passed + failed
  const passRate = ((passed / total) * 100).toFixed(1)
  console.log(`  Results: ${passed}/${total} passed (${passRate}%)`)
  if (failures.length > 0) {
    console.log('\n  Failures:')
    for (const f of failures) {
      console.log(`    • ${f}`)
    }
  }
  console.log('══════════════════════════════════════════════════════════════\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\n❌ Test script failed:', error)
  process.exit(1)
})
