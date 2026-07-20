import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { UpdateBriefSchema } from '@/lib/schemas/brief'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may view brief details' },
      { status: 403 },
    )
  }

  try {
    const brief = await prisma.brief.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        referenceNumber: true,
        subject: true,
        description: true,
        submittingEntity: true,
        expertiseArea: true,
        subType: true,
        urgency: true,
        status: true,
        receivedAt: true,
        dueDate: true,
        estimatedHours: true,
        isRepeatMatter: true,
        parentBriefId: true,
        parentBrief: {
          select: { referenceNumber: true },
        },
        allocations: {
          where: { isActive: true },
          select: {
            id: true,
            hoursAllocated: true,
            allocationMethod: true,
            allocatedAt: true,
            notes: true,
            staff: {
              select: { fullName: true, designation: true },
            },
          },
          take: 1,
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            storedPath: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    }

    const activeAllocation = brief.allocations[0] || null

    return NextResponse.json({
      id: brief.id,
      referenceNumber: brief.referenceNumber,
      subject: brief.subject,
      description: brief.description,
      submittingEntity: brief.submittingEntity,
      expertiseArea: brief.expertiseArea,
      subType: brief.subType,
      urgency: brief.urgency,
      status: brief.status,
      receivedAt: brief.receivedAt.toISOString(),
      dueDate: brief.dueDate?.toISOString() || null,
      estimatedHours: Number(brief.estimatedHours),
      isRepeatMatter: brief.isRepeatMatter,
      parentBriefId: brief.parentBriefId || null,
      parentBriefReference: brief.parentBrief?.referenceNumber || null,
      assignment: activeAllocation
        ? {
            allocationId: activeAllocation.id,
            staffName: activeAllocation.staff.fullName,
            designation: activeAllocation.staff.designation,
            allocationMethod: activeAllocation.allocationMethod,
            allocatedAt: activeAllocation.allocatedAt.toISOString(),
            hoursAllocated: Number(activeAllocation.hoursAllocated),
            notes: activeAllocation.notes,
          }
        : null,
      attachments: brief.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileType: a.fileType,
        fileSize: a.fileSize,
        storedPath: a.storedPath,
        createdAt: a.createdAt.toISOString(),
      })),
    }, { status: 200 })
  } catch (error: unknown) {
    console.error('[GET /api/briefs/:id] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may update briefs' },
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

  const existing = await prisma.brief.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, deletedAt: true },
  })

  if (!existing || existing.deletedAt !== null) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  const statusPayload = rawBody as Record<string, unknown>

  if (statusPayload.action === 'DELETE') {
    try {
      await prisma.$transaction(async (tx) => {
        const activeAllocation = await tx.allocation.findFirst({
          where: { briefId: params.id, isActive: true },
          select: { staffId: true, hoursAllocated: true, allocatedAt: true },
        })

        await tx.brief.update({
          where: { id: params.id },
          data: { deletedAt: new Date() },
        })

        await tx.allocation.updateMany({
          where: { briefId: params.id, isActive: true },
          data: { isActive: false },
        })

        if (activeAllocation) {
          const workloadDate = new Date(activeAllocation.allocatedAt)
          workloadDate.setUTCHours(0, 0, 0, 0)

          const workloadRow = await tx.dailyWorkload.findUnique({
            where: {
              staffId_workDate: {
                staffId: activeAllocation.staffId,
                workDate: workloadDate,
              },
            },
            select: { id: true, briefCount: true, hoursAllocated: true },
          })

          if (workloadRow) {
            await tx.dailyWorkload.update({
              where: { id: workloadRow.id },
              data: {
                briefCount: Math.max(0, workloadRow.briefCount - 1),
                hoursAllocated: Math.max(0, Number(workloadRow.hoursAllocated) - Number(activeAllocation.hoursAllocated)),
              },
            })
          }
        }

        await tx.allocationQueue.updateMany({
          where: { briefId: params.id, resolvedAt: null },
          data: { resolvedAt: new Date(), resolvedById: actorId },
        })

        await tx.auditLog.create({
          data: {
            eventType: 'BRIEF_CLOSED',
            actorId,
            briefId: params.id,
            payload: { previousStatus: existing.status, action: 'DELETED' },
          },
        })
      })

      revalidatePath('/dashboard')

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (error: unknown) {
      console.error('[PATCH /api/briefs/:id] Delete failed:', error)
      return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
    }
  }

  if (statusPayload.action === 'CLOSE') {
    try {
      await prisma.$transaction(async (tx) => {
        const activeAllocation = await tx.allocation.findFirst({
          where: { briefId: params.id, isActive: true },
          select: { staffId: true, hoursAllocated: true, allocatedAt: true },
        })

        await tx.brief.update({
          where: { id: params.id },
          data: { status: 'CLOSED' },
        })

        await tx.allocation.updateMany({
          where: { briefId: params.id, isActive: true },
          data: { isActive: false },
        })

        if (activeAllocation) {
          const workloadDate = new Date(activeAllocation.allocatedAt)
          workloadDate.setUTCHours(0, 0, 0, 0)

          const workloadRow = await tx.dailyWorkload.findUnique({
            where: {
              staffId_workDate: {
                staffId: activeAllocation.staffId,
                workDate: workloadDate,
              },
            },
            select: { id: true, briefCount: true, hoursAllocated: true },
          })

          if (workloadRow) {
            await tx.dailyWorkload.update({
              where: { id: workloadRow.id },
              data: {
                briefCount: Math.max(0, workloadRow.briefCount - 1),
                hoursAllocated: Math.max(0, Number(workloadRow.hoursAllocated) - Number(activeAllocation.hoursAllocated)),
              },
            })
          }
        }

        await tx.allocationQueue.updateMany({
          where: { briefId: params.id, resolvedAt: null },
          data: { resolvedAt: new Date(), resolvedById: actorId },
        })

        await tx.auditLog.create({
          data: {
            eventType: 'BRIEF_CLOSED',
            actorId,
            briefId: params.id,
            payload: { previousStatus: existing.status, action: 'CLOSED' },
          },
        })
      })

      revalidatePath('/dashboard')

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (error: unknown) {
      console.error('[PATCH /api/briefs/:id] Close failed:', error)
      return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
    }
  }

  const parsed = UpdateBriefSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  const data = parsed.data

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ id: params.id }, { status: 200 })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const brief = await tx.brief.update({
        where: { id: params.id },
        data: {
          ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.submittingEntity !== undefined && { submittingEntity: data.submittingEntity }),
          ...(data.expertiseArea !== undefined && { expertiseArea: data.expertiseArea }),
          ...(data.subType !== undefined && { subType: data.subType }),
          ...(data.urgency !== undefined && { urgency: data.urgency }),
          ...(data.dueDate !== undefined && {
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
          }),
          ...(data.estimatedHours !== undefined && { estimatedHours: data.estimatedHours }),
          ...(data.isRepeatMatter !== undefined && { isRepeatMatter: data.isRepeatMatter }),
          ...(data.parentBriefId !== undefined && { parentBriefId: data.parentBriefId || null }),
        },
        select: { id: true },
      })

      await tx.auditLog.create({
        data: {
          eventType: 'BRIEF_STATUS_CHANGED',
          actorId,
          briefId: params.id,
          payload: { fieldsUpdated: Object.keys(data) },
        },
      })

      return brief
    })

    return NextResponse.json({ id: updated.id }, { status: 200 })
  } catch (error: unknown) {
    console.error('[PATCH /api/briefs/:id] Update failed:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
