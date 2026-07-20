import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { BriefStatus } from '@prisma/client'
import { listStaff } from '@/server/services/staff.service'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()

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

  const initialData = {
    activeCounselCount: activeStaff.length,
    queueAlertCount: queueFormatted.length,
    briefsTodayCount: totalBriefsToday,
    completedTodayCount: completedToday,
    briefStatuses,
    queueItems: queueFormatted,
    assignedStaff,
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Welcome back, {session?.user?.name || 'User'}
          </p>
        </div>
      </div>
      <DashboardShell initialData={initialData} />
    </div>
  )
}
