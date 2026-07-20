import { NextResponse } from 'next/server'
import { BriefStatus } from '@prisma/client'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Always derive staffId from session — never trust client-provided staffId
  const staffId = session.user.staffId

  if (!staffId) {
    return NextResponse.json(
      { error: 'Forbidden: no staff profile linked to this account' },
      { status: 403 },
    )
  }

  try {
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        fullName: true,
        designation: true,
        seniority: true,
      },
    })

    if (!staff) {
      return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const [dailyWorkload, currentAssignments, history] = await Promise.all([
      prisma.dailyWorkload.findUnique({
        where: {
          staffId_workDate: { staffId, workDate: today },
        },
        select: {
          hoursAllocated: true,
          briefCount: true,
        },
      }),

      prisma.allocation.findMany({
        where: {
          staffId,
          isActive: true,
          brief: {
            status: { in: [BriefStatus.ALLOCATED, BriefStatus.IN_PROGRESS] },
            deletedAt: null,
          },
        },
        select: {
          id: true,
          allocationMethod: true,
          hoursAllocated: true,
          allocatedAt: true,
          notes: true,
          brief: {
            select: {
              id: true,
              referenceNumber: true,
              subject: true,
              description: true,
              expertiseArea: true,
              subType: true,
              urgency: true,
              status: true,
              dueDate: true,
              estimatedHours: true,
              submittingEntity: true,
              documentReference: true,
              attachments: {
                select: {
                  id: true,
                  fileName: true,
                  fileType: true,
                  fileSize: true,
                  storedPath: true,
                },
              },
            },
          },
        },
        orderBy: { allocatedAt: 'desc' },
      }),

      prisma.allocation.findMany({
        where: {
          staffId,
          OR: [
            { isActive: false },
            { brief: { status: { in: [BriefStatus.COMPLETED, BriefStatus.CLOSED] } } },
          ],
          brief: { deletedAt: null },
        },
        select: {
          id: true,
          hoursAllocated: true,
          allocatedAt: true,
          brief: {
            select: {
              id: true,
              referenceNumber: true,
              subject: true,
              status: true,
              expertiseArea: true,
            },
          },
        },
        orderBy: { allocatedAt: 'desc' },
        take: 50,
      }),
    ])

    const completedToday = await prisma.allocation.count({
      where: {
        staffId,
        brief: {
          status: BriefStatus.COMPLETED,
        },
      },
    })

    return NextResponse.json(
      {
        staff: {
          ...staff,
          seniority: staff.seniority,
        },
        todayWorkload: {
          hoursAllocated: dailyWorkload ? Number(dailyWorkload.hoursAllocated) : 0,
          briefCount: dailyWorkload?.briefCount ?? 0,
          completedCount: completedToday,
        },
        currentAssignments: currentAssignments.map((a) => ({
          allocationId: a.id,
          allocationMethod: a.allocationMethod,
          hoursAllocated: Number(a.hoursAllocated),
          allocatedAt: a.allocatedAt.toISOString(),
          notes: a.notes,
          brief: {
            ...a.brief,
            dueDate: a.brief.dueDate?.toISOString() || null,
            estimatedHours: Number(a.brief.estimatedHours),
            attachments: a.brief.attachments.map((att) => ({
              id: att.id,
              fileName: att.fileName,
              fileType: att.fileType,
              fileSize: att.fileSize,
              storedPath: att.storedPath,
            })),
          },
        })),
        history: history.map((a) => ({
          allocationId: a.id,
          hoursAllocated: Number(a.hoursAllocated),
          allocatedAt: a.allocatedAt.toISOString(),
          brief: {
            id: a.brief.id,
            referenceNumber: a.brief.referenceNumber,
            subject: a.brief.subject,
            status: a.brief.status,
            expertiseArea: a.brief.expertiseArea,
          },
        })),
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[GET /api/me/allocations] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
