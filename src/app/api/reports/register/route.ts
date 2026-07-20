import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { BriefStatus, Prisma } from '@prisma/client'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET(req: NextRequest) {
  const authError = await requireDSG()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  const statusParam = searchParams.get('status')

  if (!dateParam) {
    return NextResponse.json({ error: 'date query parameter is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const date = new Date(dateParam + 'T00:00:00.000Z')
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 })
  }

  const endOfDay = new Date(date.getTime() + 86400000)

  const where: Prisma.BriefWhereInput = {
    deletedAt: null,
    receivedAt: {
      gte: date,
      lt: endOfDay,
    },
  }

  if (statusParam) {
    where.status = statusParam as BriefStatus
  }

  try {
    const briefs = await prisma.brief.findMany({
      where,
      select: {
        id: true,
        referenceNumber: true,
        subject: true,
        expertiseArea: true,
        urgency: true,
        status: true,
        estimatedHours: true,
        receivedAt: true,
        allocations: {
          where: { isActive: true },
          select: {
            allocationMethod: true,
            hoursAllocated: true,
            staff: {
              select: { fullName: true },
            },
          },
          take: 1,
        },
      },
      orderBy: { receivedAt: 'asc' },
    })

    const rows = briefs.map((b) => ({
      id: b.id,
      referenceNumber: b.referenceNumber,
      subject: b.subject,
      expertiseArea: b.expertiseArea,
      urgency: b.urgency,
      status: b.status,
      estimatedHours: Number(b.estimatedHours),
      receivedAt: b.receivedAt.toISOString(),
      assignedCounsel: b.allocations[0]?.staff?.fullName || null,
      allocationMethod: b.allocations[0]?.allocationMethod || null,
      hoursAllocated: b.allocations[0] ? Number(b.allocations[0].hoursAllocated) : null,
    }))

    return NextResponse.json({ date: dateParam, briefs: rows }, { status: 200 })
  } catch (error: unknown) {
    console.error('[GET /api/reports/register] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
