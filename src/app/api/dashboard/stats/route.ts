import { NextResponse } from 'next/server'
import { BriefStatus } from '@prisma/client'
import { prisma } from '@/server/db'
import { listStaff } from '@/server/services/staff.service'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET() {
  const authError = await requireDSG()
  if (authError) return authError

  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const [staff, queueItems, todayStatusCounts, completedToday, staffWithAllocations] = await Promise.all([
      listStaff(),
      prisma.allocationQueue.findMany({
        where: { resolvedAt: null, brief: { deletedAt: null } },
        orderBy: { queuedAt: 'asc' },
        select: {
          id: true,
          queuedAt: true,
          queuedReason: true,
          brief: {
            select: {
              id: true,
              referenceNumber: true,
              subject: true,
              submittingEntity: true,
              urgency: true,
              expertiseArea: true,
              estimatedHours: true,
              receivedAt: true,
            },
          },
        },
      }),
      prisma.brief.groupBy({
        by: ['status'],
        where: { deletedAt: null, receivedAt: { gte: today } },
        _count: { status: true },
      }),
      prisma.brief.count({
        where: {
          status: BriefStatus.COMPLETED,
          deletedAt: null,
          updatedAt: { gte: today },
        },
      }),
      prisma.staff.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          allocations: {
            some: {
              isActive: true,
              brief: {
                deletedAt: null,
                status: { in: [BriefStatus.ALLOCATED, BriefStatus.IN_PROGRESS] },
              },
            },
          },
        },
        select: {
          id: true,
          fullName: true,
          designation: true,
          seniority: true,
          allocations: {
            where: {
              isActive: true,
              brief: {
                deletedAt: null,
                status: { in: [BriefStatus.ALLOCATED, BriefStatus.IN_PROGRESS] },
              },
            },
            select: { hoursAllocated: true },
          },
        },
      }),
    ])

    const activeStaff = staff.filter((s) => s.isActive)
    const totalBriefsToday = staff.reduce(
      (sum, s) => sum + s.today.briefCount,
      0,
    )

    const briefStatusMap: Record<string, number> = {}
    for (const item of todayStatusCounts) {
      briefStatusMap[item.status] = item._count.status
    }

    const briefStatuses = [
      { status: BriefStatus.RECEIVED, count: briefStatusMap.RECEIVED || 0 },
      { status: BriefStatus.QUEUED, count: briefStatusMap.QUEUED || 0 },
      { status: BriefStatus.ALLOCATED, count: briefStatusMap.ALLOCATED || 0 },
      { status: BriefStatus.IN_PROGRESS, count: briefStatusMap.IN_PROGRESS || 0 },
      { status: BriefStatus.COMPLETED, count: briefStatusMap.COMPLETED || 0 },
      { status: BriefStatus.CLOSED, count: briefStatusMap.CLOSED || 0 },
    ]

    const queueFormatted = queueItems.map((item) => ({
      ...item,
      brief: {
        ...item.brief,
        estimatedHours: Number(item.brief.estimatedHours),
        receivedAt: item.brief.receivedAt.toISOString(),
      },
      queuedAt: item.queuedAt.toISOString(),
    }))

    const assignedStaff = staffWithAllocations.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      designation: s.designation,
      seniority: s.seniority,
      isActive: true,
      today: {
        hoursAllocated: s.allocations.reduce((sum, a) => sum + Number(a.hoursAllocated), 0),
        briefCount: s.allocations.length,
      },
    }))

    return NextResponse.json(
      {
        activeCounselCount: activeStaff.length,
        queueAlertCount: queueFormatted.length,
        briefsTodayCount: totalBriefsToday,
        completedTodayCount: completedToday,
        briefStatuses,
        queueItems: queueFormatted,
        assignedStaff,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[GET /api/dashboard/stats] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
