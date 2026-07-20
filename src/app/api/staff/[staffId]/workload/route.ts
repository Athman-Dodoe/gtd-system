import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/server/auth'
import { getStaffWorkloadHistory } from '@/server/services/staff.service'
import { requireDSG } from '@/server/middleware/requireDSG'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(365).default(30),
})

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
      { error: 'Forbidden: only DSG users may view workload history' },
      { status: 403 },
    )
  }

  const queryParsed = QuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  )
  if (!queryParsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', issues: queryParsed.error.issues },
      { status: 422 },
    )
  }

  try {
    const workloads = await getStaffWorkloadHistory(
      params.staffId,
      queryParsed.data.limit,
    )
    return NextResponse.json(
      { staffId: params.staffId, workloads },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[GET /api/staff/:staffId/workload] Failed:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
