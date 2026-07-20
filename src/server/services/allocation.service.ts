// =============================================================================
// AllocationService — Orchestrator
// =============================================================================
// This is the IMPURE SHELL that surrounds the pure AllocationEngine.
// Responsibility split:
//   AllocationService  → I/O: fetches from DB, writes decisions back to DB
//   AllocationEngine   → Logic: pure decision making, no I/O
//
// Public API:
//   runAllocation(briefId, actorId) → Promise<AllocationResult>
//
// The caller (API route or internal trigger) only needs to pass the briefId
// and the actorId of whoever initiated the allocation (for the audit log).
// All data fetching and all DB writes happen inside this service.
// =============================================================================

import { BriefStatus, AuditEventType, Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { AllocationEngine } from '@/domain/allocation/engine'
import type { AllocationResult, BriefInput, StaffCandidate } from '@/domain/allocation/types'
import { sendBriefAllocationEmail } from '@/server/services/email.service'

// Singleton engine instance — stateless, safe to reuse across requests
const engine = new AllocationEngine()

// =============================================================================
// PUBLIC FUNCTION
// =============================================================================

/**
 * Run the allocation engine for a single brief.
 *
 * Steps:
 *  1. Fetch the brief and validate it is in RECEIVED status
 *  2. Resolve priorStaffId for repeat matters
 *  3. Fetch all active staff with their expertise profiles
 *  4. Fetch today's workload snapshot for each candidate
 *  5. Map Prisma records → plain domain objects
 *  6. Call AllocationEngine.allocate() — pure, no I/O
 *  7. Execute DB writes in a single Prisma transaction based on the result
 *
 * @param briefId  - ID of the brief to allocate
 * @param actorId  - User ID of the actor triggering allocation (for audit log)
 * @returns        The AllocationResult from the engine (pass to caller for response shaping)
 * @throws         Error if the brief is not found or is not in RECEIVED status
 */
export async function runAllocation(briefId: string, actorId: string): Promise<AllocationResult> {
  // ── Step 1: Fetch and validate brief ───────────────────────────────────────
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    select: {
      id: true,
      urgency: true,
      expertiseArea: true,
      estimatedHours: true,
      isRepeatMatter: true,
      parentBriefId: true,
      status: true,
      referenceNumber: true,
      subject: true,
    },
  })

  if (!brief) {
    throw new Error(`AllocationService: brief not found — id=${briefId}`)
  }

  if (brief.status !== BriefStatus.RECEIVED) {
    throw new Error(
      `AllocationService: brief is not in RECEIVED status — id=${briefId}, status=${brief.status}`,
    )
  }

  // ── Step 2: Resolve priorStaffId for repeat matters ────────────────────────
  let priorStaffId: string | null = null

  if (brief.isRepeatMatter && brief.parentBriefId) {
    const parentAllocation = await prisma.allocation.findFirst({
      where: { briefId: brief.parentBriefId, isActive: true },
      select: { staffId: true },
      orderBy: { allocatedAt: 'desc' },
    })
    priorStaffId = parentAllocation?.staffId ?? null
  }

  // ── Step 3: Fetch active staff with their expertise ─────────────────────────
  const staffRecords = await prisma.staff.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      seniority: true,
      isActive: true,
      expertiseAreas: {
        select: { expertiseArea: true, isPrimary: true },
      },
    },
  })

  // ── Step 4: Fetch today's workload for each candidate ───────────────────────
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const workloadRecords = await prisma.dailyWorkload.findMany({
    where: {
      staffId: { in: staffRecords.map((s) => s.id) },
      workDate: today,
    },
    select: { staffId: true, hoursAllocated: true, briefCount: true },
  })

  const workloadByStaff = new Map(workloadRecords.map((w) => [w.staffId, w]))

  // ── Step 5: Map to plain domain objects ─────────────────────────────────────
  const briefInput: BriefInput = {
    id: brief.id,
    urgency: brief.urgency,
    expertiseArea: brief.expertiseArea,
    estimatedHours: Number(brief.estimatedHours), // Prisma Decimal → number
    isRepeatMatter: brief.isRepeatMatter,
    priorStaffId,
  }

  const candidates: StaffCandidate[] = staffRecords.map((s) => {
    const workload = workloadByStaff.get(s.id)
    return {
      id: s.id,
      seniority: s.seniority,
      isActive: s.isActive,
      expertiseAreas: s.expertiseAreas.map((e) => ({
        area: e.expertiseArea,
        isPrimary: e.isPrimary,
      })),
      hoursToday: workload ? Number(workload.hoursAllocated) : 0,
      briefCountToday: workload?.briefCount ?? 0,
    }
  })

  // ── Step 6: Call the pure engine ────────────────────────────────────────────
  const result = engine.allocate(briefInput, candidates)

  // ── Step 7: Write the decision to the DB in a single transaction ─────────────
  await prisma.$transaction(async (tx) => {
    switch (result.outcome) {
      case 'ALLOCATED': {
        // Create Allocation record
        const allocation = await tx.allocation.create({
          data: {
            briefId: brief.id,
            staffId: result.staffId,
            allocationMethod: result.method,
            allocatedById: actorId,
            hoursAllocated: new Prisma.Decimal(briefInput.estimatedHours),
            notes: result.reason,
          },
        })

        // Update brief status → ALLOCATED
        await tx.brief.update({
          where: { id: brief.id },
          data: { status: BriefStatus.ALLOCATED },
        })

        // Upsert today's DailyWorkload snapshot (increment hours + brief count)
        await tx.dailyWorkload.upsert({
          where: {
            staffId_workDate: { staffId: result.staffId, workDate: today },
          },
          create: {
            staffId: result.staffId,
            workDate: today,
            hoursAllocated: new Prisma.Decimal(briefInput.estimatedHours),
            briefCount: 1,
          },
          update: {
            hoursAllocated: { increment: briefInput.estimatedHours },
            briefCount: { increment: 1 },
          },
        })

        // Append audit log entry
        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.BRIEF_ALLOCATED,
            actorId,
            briefId: brief.id,
            staffId: result.staffId,
            allocationId: allocation.id,
            payload: {
              method: result.method,
              reason: result.reason,
              hoursAllocated: briefInput.estimatedHours,
            },
          },
        })
        break
      }

      case 'QUEUED': {
        // Put brief in AllocationQueue
        await tx.allocationQueue.create({
          data: {
            briefId: brief.id,
            queuedReason: result.reason,
            dsgAlertedAt: new Date(),
          },
        })

        // Update brief status → QUEUED
        await tx.brief.update({
          where: { id: brief.id },
          data: { status: BriefStatus.QUEUED },
        })

        // Append audit log entry
        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.BRIEF_QUEUED,
            actorId,
            briefId: brief.id,
            payload: { reason: result.reason },
          },
        })
        break
      }

      case 'REPEAT_MATTER_FALLBACK': {
        // Treat like QUEUED but with a specific audit event for the DSG alert
        await tx.allocationQueue.create({
          data: {
            briefId: brief.id,
            queuedReason: result.reason,
            dsgAlertedAt: new Date(),
          },
        })

        // Update brief status → QUEUED
        await tx.brief.update({
          where: { id: brief.id },
          data: { status: BriefStatus.QUEUED },
        })

        // Two audit entries: one for the fallback, one for the queue
        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.REPEAT_MATTER_FALLBACK,
            actorId,
            briefId: brief.id,
            staffId: result.priorStaffId,
            payload: {
              priorStaffId: result.priorStaffId,
              reason: result.reason,
            },
          },
        })

        await tx.auditLog.create({
          data: {
            eventType: AuditEventType.BRIEF_QUEUED,
            actorId,
            briefId: brief.id,
            payload: { reason: result.reason, trigger: 'REPEAT_MATTER_FALLBACK' },
          },
        })
        break
      }
    }
  })

  // ── Step 8: Fire allocation email (non-blocking, outside transaction) ────────
  // Only send when the engine actually allocated — not for QUEUED or fallback.
  // We do a minimal fetch here (email + fullName) rather than adding email to
  // the StaffCandidate type, which is a pure-domain object that should stay I/O-free.
  if (result.outcome === 'ALLOCATED') {
    const staffRecord = await prisma.staff.findUnique({
      where: { id: result.staffId },
      select: { email: true, fullName: true },
    })

    if (staffRecord) {
      sendBriefAllocationEmail({
        to: staffRecord.email,
        counselName: staffRecord.fullName,
        briefRef: brief.referenceNumber,
        subject: brief.subject,
        urgency: brief.urgency,
        estimatedHours: Number(brief.estimatedHours),
        expertiseArea: brief.expertiseArea,
      }).catch((err) => console.error('[EMAIL] sendBriefAllocationEmail error:', err))
    }
  }

  return result
}
