// =============================================================================
// GET /api/queue
// =============================================================================
// Lists all unresolved items in the brief allocation queue.
// DSG role only.
//
// Response shape: Array of unresolved Queue items, containing the
// nested Brief details.
// =============================================================================

import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET() {
  const authError = await requireDSG()
  if (authError) return authError

  try {
    // Fetch unresolved queue items ordered by queuedAt (FIFO - oldest first)
    const queueItems = await prisma.allocationQueue.findMany({
      where: {
        resolvedAt: null,
        brief: { deletedAt: null },
      },
      orderBy: {
        queuedAt: 'asc',
      },
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
    })

    // Flatten estimatedHours from Prisma.Decimal to number
    const formattedQueueItems = queueItems.map((item) => ({
      id: item.id,
      queuedAt: item.queuedAt,
      queuedReason: item.queuedReason,
      brief: {
        ...item.brief,
        estimatedHours: Number(item.brief.estimatedHours),
      },
    }))

    return NextResponse.json(formattedQueueItems, { status: 200 })
  } catch (error) {
    console.error('[GET /api/queue] Failed to fetch queue items:', error)
    return NextResponse.json({ error: 'Failed to fetch queue items' }, { status: 500 })
  }
}
