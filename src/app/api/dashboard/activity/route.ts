import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET() {
  const authError = await requireDSG()
  if (authError) return authError

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { briefId: null },
          { brief: { deletedAt: null } },
        ],
      },
      select: {
        id: true,
        eventType: true,
        occurredAt: true,
        payload: true,
        actor: { select: { name: true } },
        brief: { select: { referenceNumber: true, subject: true } },
        staff: { select: { fullName: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    })

    return NextResponse.json(
      logs.map((l) => ({
        id: l.id,
        eventType: l.eventType,
        occurredAt: l.occurredAt.toISOString(),
        payload: l.payload,
        actorName: l.actor?.name ?? null,
        briefReference: l.brief?.referenceNumber ?? null,
        briefSubject: l.brief?.subject ?? null,
        staffName: l.staff?.fullName ?? null,
      })),
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[GET /api/dashboard/activity] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
