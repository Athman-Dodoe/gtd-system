import { NextRequest, NextResponse } from 'next/server'
import { BriefStatus, AllocationMethod, AuditEventType } from '@prisma/client'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function POST(req: NextRequest) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may reassign briefs' },
      { status: 403 },
    )
  }

  const actorId = session.user.id

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body: malformed JSON' }, { status: 400 })
  }

  const { briefId, staffId } = rawBody as { briefId?: string; staffId?: string }

  if (!briefId || !staffId) {
    return NextResponse.json(
      { error: 'briefId and staffId are required' },
      { status: 422 },
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const brief = await tx.brief.findUnique({
        where: { id: briefId },
        select: { id: true, status: true, estimatedHours: true },
      })

      if (!brief) {
        throw new Error('Brief not found')
      }

      if (brief.status === BriefStatus.CLOSED || brief.status === BriefStatus.COMPLETED) {
        throw new Error(`Cannot reassign a brief with status ${brief.status}`)
      }

      const targetStaff = await tx.staff.findUnique({
        where: { id: staffId },
        select: { id: true, isActive: true, fullName: true },
      })

      if (!targetStaff || !targetStaff.isActive) {
        throw new Error('Target staff member not found or inactive')
      }

      const previousAllocation = await tx.allocation.findFirst({
        where: { briefId, isActive: true },
        select: { staffId: true, hoursAllocated: true, allocatedAt: true },
      })

      await tx.allocation.updateMany({
        where: { briefId, isActive: true },
        data: { isActive: false },
      })

      const allocation = await tx.allocation.create({
        data: {
          briefId,
          staffId,
          allocationMethod: AllocationMethod.MANUAL_DSG,
          allocatedById: actorId,
          hoursAllocated: brief.estimatedHours,
        },
        select: { id: true },
      })

      await tx.brief.update({
        where: { id: briefId },
        data: { status: BriefStatus.ALLOCATED },
      })

      const today = new Date()
      today.setUTCHours(0, 0, 0, 0)

      if (previousAllocation) {
        const workloadDate = new Date(previousAllocation.allocatedAt)
        workloadDate.setUTCHours(0, 0, 0, 0)

        const prevWorkload = await tx.dailyWorkload.findUnique({
          where: {
            staffId_workDate: {
              staffId: previousAllocation.staffId,
              workDate: workloadDate,
            },
          },
          select: { id: true, briefCount: true, hoursAllocated: true },
        })

        if (prevWorkload) {
          await tx.dailyWorkload.update({
            where: { id: prevWorkload.id },
            data: {
              briefCount: Math.max(0, prevWorkload.briefCount - 1),
              hoursAllocated: Math.max(0, Number(prevWorkload.hoursAllocated) - Number(previousAllocation.hoursAllocated)),
            },
          })
        }
      }

      await tx.dailyWorkload.upsert({
        where: {
          staffId_workDate: { staffId, workDate: today },
        },
        create: {
          staffId,
          workDate: today,
          hoursAllocated: brief.estimatedHours,
          briefCount: 1,
        },
        update: {
          hoursAllocated: { increment: Number(brief.estimatedHours) },
          briefCount: { increment: 1 },
        },
      })

      await tx.allocationQueue.updateMany({
        where: { briefId, resolvedAt: null },
        data: { resolvedAt: new Date(), resolvedById: actorId },
      })

      await tx.auditLog.create({
        data: {
          eventType: AuditEventType.MANUAL_ASSIGNMENT_BY_DSG,
          actorId,
          briefId,
          allocationId: allocation.id,
          staffId,
          payload: {
            briefId,
            newStaffId: staffId,
            newStaffName: targetStaff.fullName,
            method: AllocationMethod.MANUAL_DSG,
          },
        },
      })

      return { allocationId: allocation.id }
    })

    return NextResponse.json(
      { success: true, allocationId: result.allocationId },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[POST /api/allocations] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
