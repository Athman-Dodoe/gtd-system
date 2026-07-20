import { NextRequest, NextResponse } from 'next/server'
import { Prisma, AuditEventType } from '@prisma/client'
import { prisma } from '@/server/db'
import { requireDSG } from '@/server/middleware/requireDSG'

const PAGE_SIZE = 20

export async function GET(req: NextRequest) {
  const authError = await requireDSG()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const eventType = searchParams.get('eventType')
  const pageParam = searchParams.get('page')

  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)

  const where: Prisma.AuditLogWhereInput = {}

  if (from) {
    const fromDate = new Date(from + 'T00:00:00.000Z')
    if (!isNaN(fromDate.getTime())) {
      where.occurredAt = { ...(where.occurredAt as object || {}), gte: fromDate }
    }
  }

  if (to) {
    const toDate = new Date(to + 'T23:59:59.999Z')
    if (!isNaN(toDate.getTime())) {
      where.occurredAt = { ...(where.occurredAt as object || {}), lte: toDate }
    }
  }

  if (eventType && Object.values(AuditEventType).includes(eventType as AuditEventType)) {
    where.eventType = eventType as AuditEventType
  }

  try {
    const [logs, total] = await Promise.all([
      // TODO (Performance): This uses offset pagination (skip/take) which is fine for <50k rows
      // because of the occurredAt index. If the audit log grows significantly larger,
      // this should be migrated to cursor-based pagination (using id or occurredAt + id)
      // to avoid deep offset performance degradation.
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          eventType: true,
          occurredAt: true,
          payload: true,
          actor: { select: { name: true } },
          brief: { select: { referenceNumber: true } },
          staff: { select: { fullName: true } },
        },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json(
      {
        logs: logs.map((l) => ({
          id: l.id,
          eventType: l.eventType,
          occurredAt: l.occurredAt.toISOString(),
          payload: l.payload,
          actorName: l.actor?.name || null,
          briefReference: l.brief?.referenceNumber || null,
          staffName: l.staff?.fullName || null,
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[GET /api/reports/audit] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
