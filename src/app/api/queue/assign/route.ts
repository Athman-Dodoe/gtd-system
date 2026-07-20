// =============================================================================
// POST /api/queue/assign
// =============================================================================
// Manually allocates a queued brief to a counsel.
// DSG role only.
//
// Request body  → AssignSchema (Zod)
// Status codes:
//   200  Successful manual allocation
//   400  Malformed JSON
//   401  Unauthorized
//   403  Forbidden (non-DSG)
//   422  Validation errors or business rule violation
//   500  Server error
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/server/auth'
import { manuallyAssignBrief } from '@/server/services/queue.service'
import { requireDSG } from '@/server/middleware/requireDSG'

const AssignSchema = z.object({
  briefId: z.string().uuid(),
  staffId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const authError = await requireDSG()
  if (authError) return authError

  // ── Auth guard ─────────────────────────────────────────────────────────────
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may perform manual assignments' },
      { status: 403 }
    )
  }

  const actorId = session.user.id

  // ── Parse request body ──────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body: malformed JSON' }, { status: 400 })
  }

  // ── Validate inputs ────────────────────────────────────────────────────────
  const parsed = AssignSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    )
  }

  const { briefId, staffId, notes } = parsed.data

  try {
    // ── Call QueueService ─────────────────────────────────────────────────────
    const result = await manuallyAssignBrief(briefId, staffId, actorId, notes)
    return NextResponse.json(
      {
        success: true,
        message: 'Brief successfully assigned manually.',
        allocationId: result.allocationId,
      },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('[POST /api/queue/assign] Manual assignment failed:', error)
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 }
    )
  }
}
