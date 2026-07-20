import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/server/auth'
import {
  getStaffProfile,
  updateStaff,
  removeStaff,
  StaffConflictError,
} from '@/server/services/staff.service'
import { UpdateStaffSchema } from '@/lib/schemas/staff'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET(
  req: NextRequest,
  { params }: { params: { staffId: string } },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may view staff profiles' },
      { status: 403 },
    )
  }

  try {
    const profile = await getStaffProfile(params.staffId)
    return NextResponse.json(profile, { status: 200 })
  } catch (error: unknown) {
    console.error('[GET /api/staff/:staffId] Failed to fetch staff:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { staffId: string } },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may update staff' },
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

  const parsed = UpdateStaffSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  try {
    const profile = await updateStaff(params.staffId, actorId, parsed.data)
    return NextResponse.json(profile, { status: 200 })
  } catch (error: unknown) {
    console.error('[PATCH /api/staff/:staffId] Failed to update staff:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { staffId: string } },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may remove staff' },
      { status: 403 },
    )
  }

  const actorId = session.user.id

  try {
    await removeStaff(params.staffId, actorId)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: unknown) {
    if (error instanceof StaffConflictError) {
      return NextResponse.json(
        { error: 'Cannot remove staff with active brief allocations. Reassign or complete their active briefs first.', activeBriefs: error.activeBriefs },
        { status: 409 },
      )
    }
    console.error('[DELETE /api/staff/:staffId] Failed to remove staff:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
