// =============================================================================
// POST /api/briefs
// =============================================================================
// Creates a new brief record and immediately runs the allocation engine.
// DSG role only — counsels cannot log briefs.
//
// Request body   → CreateBriefSchema (Zod)
// Response body  → AllocationOutcomeResponse (discriminated on `outcome`)
//
// HTTP status codes:
//   201  Brief created (regardless of allocation outcome — see `outcome` field)
//   400  Malformed JSON
//   401  Not authenticated
//   403  Authenticated but not DSG
//   422  Validation failure (Zod errors) or business rule violation
//   500  Unexpected server error (brief may or may not have been created)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { BriefStatus, Prisma } from '@prisma/client'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { runAllocation } from '@/server/services/allocation.service'
import { CreateBriefSchema } from '@/lib/schemas/brief'
import type { CreateBriefInput } from '@/lib/schemas/brief'
import { requireDSG } from '@/server/middleware/requireDSG'

// =============================================================================
// GET /api/briefs
// Returns a lightweight list of non-deleted briefs for parent brief selection.
// DSG only.
// =============================================================================

export async function GET() {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may view briefs' },
      { status: 403 },
    )
  }

  try {
    const briefs = await prisma.brief.findMany({
      where: { deletedAt: null },
      select: { id: true, referenceNumber: true, subject: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(briefs, { status: 200 })
  } catch (error: unknown) {
    console.error('[GET /api/briefs] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}

// =============================================================================
// HANDLER
// =============================================================================

export async function POST(req: NextRequest) {
  const authError = await requireDSG()
  if (authError) return authError

  // ── 1. Authentication ──────────────────────────────────────────────────────
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may log briefs' },
      { status: 403 },
    )
  }

  const actorId = session.user.id

  // ── 2. Parse request body ──────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body: malformed JSON' }, { status: 400 })
  }

  // ── 3. Zod validation ──────────────────────────────────────────────────────
  const parsed = CreateBriefSchema.safeParse(rawBody)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: parsed.error.issues,
      },
      { status: 422 },
    )
  }

  const data: CreateBriefInput = parsed.data

  // ── 4. Business rule: repeat-matter consistency ────────────────────────────
  if (data.isRepeatMatter && !data.parentBriefId) {
    return NextResponse.json(
      { error: 'parentBriefId is required when isRepeatMatter is true' },
      { status: 422 },
    )
  }

  if (!data.isRepeatMatter && data.parentBriefId) {
    return NextResponse.json(
      { error: 'parentBriefId must not be provided when isRepeatMatter is false' },
      { status: 422 },
    )
  }

  // ── 5. Validate parentBriefId exists (if provided) ─────────────────────────
  if (data.parentBriefId) {
    const parentExists = await prisma.brief.findUnique({
      where: { id: data.parentBriefId },
      select: { id: true },
    })
    if (!parentExists) {
      return NextResponse.json(
        { error: `parentBriefId not found: ${data.parentBriefId}` },
        { status: 422 },
      )
    }
  }

  // ── 6 & 7. Auto-generate reference number & Create the Brief record ────────
  const now = new Date()
  const year = now.getFullYear()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year + 1, 0, 1)

  let brief: { id: string; referenceNumber: string }
  try {
    brief = await prisma.$transaction(async (tx) => {
      const countThisYear = await tx.brief.count({
        where: {
          createdAt: { gte: yearStart, lt: yearEnd },
          deletedAt: null,
        },
      })
      const referenceNumber = `GTD/${year}/${countThisYear + 1}`

      return await tx.brief.create({
        data: {
          referenceNumber,
          subject:          data.subject,
          description:      data.description,
          submittingEntity: data.submittingEntity,
          expertiseArea:    data.expertiseArea,
          subType:          data.subType,
          urgency:          data.urgency,
          dueDate:          data.dueDate ? new Date(data.dueDate) : undefined,
          estimatedHours:   data.estimatedHours,
          isRepeatMatter:   data.isRepeatMatter,
          parentBriefId:    data.parentBriefId,
          status:           BriefStatus.RECEIVED,
          createdById:      actorId,
        },
        select: { id: true, referenceNumber: true },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    console.error('[POST /api/briefs] Brief creation failed:', error)
    return NextResponse.json({ error: 'Failed to create brief' }, { status: 500 })
  }

  const referenceNumber = brief.referenceNumber

  // ── 8. Run allocation engine ───────────────────────────────────────────────
  // If this throws, the brief exists in RECEIVED status and can be re-queued.
  // We surface this as a 500 with the briefId so the caller knows the brief
  // was persisted but allocation did not complete.
  let allocationResult: Awaited<ReturnType<typeof runAllocation>>
  try {
    allocationResult = await runAllocation(brief.id, actorId)
  } catch (error) {
    console.error('[POST /api/briefs] Allocation engine failed:', error)
    return NextResponse.json(
      {
        error: 'Brief was created but allocation failed unexpectedly',
        briefId: brief.id,
        outcome: 'ALLOCATION_ERROR',
      },
      { status: 500 },
    )
  }

  // ── 9. Resolve staff names ────────────────────────────────────────────────
  let staffName: string | null = null
  let priorStaffName: string | null = null

  if (allocationResult.outcome === 'ALLOCATED') {
    const staff = await prisma.staff.findUnique({
      where: { id: allocationResult.staffId },
      select: { fullName: true },
    })
    staffName = staff?.fullName ?? null
  }

  if (allocationResult.outcome === 'REPEAT_MATTER_FALLBACK') {
    const staff = await prisma.staff.findUnique({
      where: { id: allocationResult.priorStaffId },
      select: { fullName: true },
    })
    priorStaffName = staff?.fullName ?? null
  }

  // ── 10. Shape response based on engine outcome ─────────────────────────────
  switch (allocationResult.outcome) {
    case 'ALLOCATED':
      return NextResponse.json(
        {
          briefId:   brief.id,
          referenceNumber,
          outcome:   'ALLOCATED',
          staffId:   allocationResult.staffId,
          staffName: staffName,
          method:    allocationResult.method,
          message:   'Brief logged and allocated to counsel successfully.',
        },
        { status: 201 },
      )

    case 'QUEUED':
      return NextResponse.json(
        {
          briefId: brief.id,
          referenceNumber,
          outcome: 'QUEUED',
          message: 'Brief logged but no counsel has available capacity. DSG must assign manually.',
          reason:  allocationResult.reason,
        },
        { status: 201 },
      )

    case 'REPEAT_MATTER_FALLBACK':
      return NextResponse.json(
        {
          briefId:        brief.id,
          referenceNumber,
          outcome:        'REPEAT_MATTER_FALLBACK',
          priorStaffId:   allocationResult.priorStaffId,
          priorStaffName: priorStaffName,
          message:
            'Repeat matter detected but prior counsel is at capacity. DSG must assign manually.',
          reason: allocationResult.reason,
        },
        { status: 201 },
      )
  }
}
