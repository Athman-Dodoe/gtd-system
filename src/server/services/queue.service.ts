// =============================================================================
// QueueService — Transactional Domain Operations
// =============================================================================
// Contains logic to resolve queue items:
//   1. manuallyAssignBrief() → Allocates a queued brief to a selected counsel
//   2. withdrawBrief()       → Closes/withdraws a queued brief
//
// All DB operations are run inside Prisma transactions to ensure data
// consistency and log audit trails.
// =============================================================================

import { BriefStatus, AllocationMethod, AuditEventType, Prisma } from '@prisma/client'
import { prisma } from '@/server/db'

// =============================================================================
// SERVICE METHODS
// =============================================================================

/**
 * Manually assign a queued brief to an active counsel.
 *
 * Enforces business rules:
 *   - The brief must exist, be in QUEUED status, and have an unresolved queue record.
 *   - The target counsel must exist and be active.
 *
 * Updates:
 *   - Sets Brief status → ALLOCATED
 *   - Resolves the AllocationQueue record (resolvedAt, resolvedById)
 *   - Creates an Allocation record with MANUAL_DSG method
 *   - Upserts the counsel's DailyWorkload (increments hours + brief count)
 *   - Appends a MANUAL_ASSIGNMENT_BY_DSG AuditLog record
 *
 * @param briefId  - The ID of the queued brief
 * @param staffId  - The ID of the target counsel
 * @param actorId  - The ID of the DSG user making the assignment
 * @param notes    - Optional justification notes for the manual override
 */
export async function manuallyAssignBrief(
  briefId: string,
  staffId: string,
  actorId: string,
  notes?: string
): Promise<{ success: boolean; allocationId: string }> {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch and validate brief & queue status
    const brief = await tx.brief.findUnique({
      where: { id: briefId },
      select: { id: true, status: true, estimatedHours: true },
    })

    if (!brief) {
      throw new Error(`QueueService: Brief not found — id=${briefId}`)
    }

    if (brief.status !== BriefStatus.QUEUED) {
      throw new Error(`QueueService: Brief is not in QUEUED status — current=${brief.status}`)
    }

    const queueItem = await tx.allocationQueue.findUnique({
      where: { briefId },
      select: { id: true, resolvedAt: true },
    })

    if (!queueItem || queueItem.resolvedAt !== null) {
      throw new Error(`QueueService: No active queue entry found for briefId=${briefId}`)
    }

    // 2. Fetch and validate target counsel
    const staff = await tx.staff.findUnique({
      where: { id: staffId },
      select: { id: true, isActive: true, deletedAt: true },
    })

    if (!staff || !staff.isActive || staff.deletedAt !== null) {
      throw new Error(`QueueService: Selected counsel is not active or does not exist — id=${staffId}`)
    }

    // 3. Create manual Allocation record
    const allocation = await tx.allocation.create({
      data: {
        briefId: brief.id,
        staffId: staff.id,
        allocationMethod: AllocationMethod.MANUAL_DSG,
        allocatedById: actorId,
        hoursAllocated: brief.estimatedHours,
        notes: notes || 'DSG manual assignment from queue',
        isActive: true,
      },
    })

    // 4. Update Brief status → ALLOCATED
    await tx.brief.update({
      where: { id: brief.id },
      data: { status: BriefStatus.ALLOCATED },
    })

    // 5. Update AllocationQueue entry to resolved
    await tx.allocationQueue.update({
      where: { briefId: brief.id },
      data: {
        resolvedAt: new Date(),
        resolvedById: actorId,
      },
    })

    // 6. Update target counsel workload snapshot
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const estimatedHoursNum = Number(brief.estimatedHours)

    await tx.dailyWorkload.upsert({
      where: {
        staffId_workDate: { staffId: staff.id, workDate: today },
      },
      create: {
        staffId: staff.id,
        workDate: today,
        hoursAllocated: new Prisma.Decimal(estimatedHoursNum),
        briefCount: 1,
      },
      update: {
        hoursAllocated: { increment: estimatedHoursNum },
        briefCount: { increment: 1 },
      },
    })

    // 7. Write AuditLog
    await tx.auditLog.create({
      data: {
        eventType: AuditEventType.MANUAL_ASSIGNMENT_BY_DSG,
        actorId,
        briefId: brief.id,
        staffId: staff.id,
        allocationId: allocation.id,
        payload: {
          notes: notes || 'Manual override assignment',
          hoursAllocated: estimatedHoursNum,
        },
      },
    })

    return { success: true, allocationId: allocation.id }
  }, { timeout: 30000, maxWait: 10000 })
}

/**
 * Withdraw a queued brief (moves status to CLOSED).
 *
 * Enforces business rules:
 *   - The brief must exist, be in QUEUED status, and have an unresolved queue record.
 *
 * Updates:
 *   - Sets Brief status → CLOSED
 *   - Resolves the AllocationQueue record (resolvedAt, resolvedById)
 *   - Appends a BRIEF_CLOSED AuditLog record
 *
 * @param briefId  - The ID of the queued brief
 * @param actorId  - The ID of the DSG user withdrawing the brief
 * @param notes    - Optional explanation for why the brief is withdrawn
 */
export async function withdrawBrief(
  briefId: string,
  actorId: string,
  notes?: string
): Promise<{ success: boolean }> {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch and validate brief & queue status
    const brief = await tx.brief.findUnique({
      where: { id: briefId },
      select: { id: true, status: true },
    })

    if (!brief) {
      throw new Error(`QueueService: Brief not found — id=${briefId}`)
    }

    if (brief.status !== BriefStatus.QUEUED) {
      throw new Error(`QueueService: Brief is not in QUEUED status — current=${brief.status}`)
    }

    const queueItem = await tx.allocationQueue.findUnique({
      where: { briefId },
      select: { id: true, resolvedAt: true },
    })

    if (!queueItem || queueItem.resolvedAt !== null) {
      throw new Error(`QueueService: No active queue entry found for briefId=${briefId}`)
    }

    // 2. Update Brief status → CLOSED
    await tx.brief.update({
      where: { id: brief.id },
      data: { status: BriefStatus.CLOSED },
    })

    // 3. Update AllocationQueue entry to resolved
    await tx.allocationQueue.update({
      where: { briefId: brief.id },
      data: {
        resolvedAt: new Date(),
        resolvedById: actorId,
      },
    })

    // 4. Write AuditLog
    await tx.auditLog.create({
      data: {
        eventType: AuditEventType.BRIEF_CLOSED,
        actorId,
        briefId: brief.id,
        payload: {
          action: 'QUEUE_WITHDRAWAL',
          notes: notes || 'DSG manual queue withdrawal',
        },
      },
    })

    return { success: true }
  }, { timeout: 30000, maxWait: 10000 })
}
