import { redirect } from 'next/navigation'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { QueuePanel } from '@/components/queue/queue-panel'

export const dynamic = 'force-dynamic'

export default async function QueuePage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  if (session.user.role !== 'DSG') {
    redirect('/dashboard')
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // Fetch queue items, staff profiles, and today's workload snapshot in parallel.
  // The staff query is scoped to only the fields QueuePanel actually renders —
  // dropping employeeNumber, dateJoined, createdAt, etc.
  // Workload is read from the pre-aggregated daily_workload snapshot (not raw
  // allocations) to keep this path fast regardless of allocation history size.
  const [rawQueueItems, rawStaff, workloadRecords] = await Promise.all([
    prisma.allocationQueue.findMany({
      where: { resolvedAt: null },
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
    prisma.staff.findMany({
      where: { deletedAt: null },
      orderBy: [{ seniority: 'asc' }, { fullName: 'asc' }],
      select: {
        id: true,
        fullName: true,
        designation: true,
        seniority: true,
        isActive: true,
        expertiseAreas: {
          select: { expertiseArea: true, isPrimary: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    }),
    prisma.dailyWorkload.findMany({
      where: { workDate: today },
      select: { staffId: true, hoursAllocated: true, briefCount: true },
    }),
  ])

  const workloadByStaff = new Map(workloadRecords.map((w) => [w.staffId, w]))

  const queueItems = rawQueueItems.map((item) => ({
    id: item.id,
    queuedAt: item.queuedAt.toISOString(),
    queuedReason: item.queuedReason,
    brief: {
      ...item.brief,
      estimatedHours: Number(item.brief.estimatedHours),
      receivedAt: item.brief.receivedAt.toISOString(),
    },
  }))

  const staffFormatted = rawStaff.map((s) => {
    const w = workloadByStaff.get(s.id)
    return {
      id: s.id,
      fullName: s.fullName,
      designation: s.designation,
      seniority: s.seniority,
      isActive: s.isActive,
      expertiseAreas: s.expertiseAreas.map((e) => ({
        expertiseArea: e.expertiseArea,
        isPrimary: e.isPrimary,
      })),
      today: {
        hoursAllocated: w ? Number(w.hoursAllocated) : 0,
        briefCount: w?.briefCount ?? 0,
      },
    }
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-white">Allocation Queue</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Manually assign queued briefs to counsel or withdraw them
        </p>
      </div>

      <QueuePanel queueItems={queueItems} staff={staffFormatted} />
    </div>
  )
}
