import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/server/auth'
import { listStaff, createStaff } from '@/server/services/staff.service'
import { CreateStaffSchema } from '@/lib/schemas/staff'
import { requireDSG } from '@/server/middleware/requireDSG'

export async function GET() {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may view staff' },
      { status: 403 },
    )
  }

  try {
    const staff = await listStaff()
    return NextResponse.json(staff, { status: 200 })
  } catch (error) {
    console.error('[GET /api/staff] Failed to list staff:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may create staff' },
      { status: 403 },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body: malformed JSON' }, { status: 400 })
  }

  const parsed = CreateStaffSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 },
    )
  }

  try {
    const profile = await createStaff(parsed.data, session.user.id)
    return NextResponse.json(profile, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/staff] Failed to create staff:', error)
    const message = error instanceof Error ? error.message : ''
    if (message.includes('Unique constraint') || message.includes('unique')) {
      return NextResponse.json(
        { error: 'A staff member with this email or employee number already exists' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
