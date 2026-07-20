import { NextRequest, NextResponse } from 'next/server'
import { BriefStatus, AuditEventType } from '@prisma/client'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { sendBriefCompletionEmail } from '@/server/services/email.service'

const ALLOWED_TRANSITIONS: Record<string, BriefStatus[]> = {
  [BriefStatus.ALLOCATED]: [BriefStatus.IN_PROGRESS],
  [BriefStatus.IN_PROGRESS]: [BriefStatus.COMPLETED],
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.jpg', '.jpeg', '.png', '.webp',
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // SECURITY: Always derive staffId from session — never trust client-provided staffId
  const staffId = session.user.staffId

  if (!staffId) {
    return NextResponse.json(
      { error: 'Forbidden: no staff profile linked to this account' },
      { status: 403 },
    )
  }

  let newStatus: string | undefined
  let completionNotes: string | undefined
  let followUpNotes: string | undefined
  const uploadedFiles: File[] = []

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    newStatus = (formData.get('status') as string) || undefined
    completionNotes = (formData.get('completionNotes') as string) || undefined
    followUpNotes = (formData.get('followUpNotes') as string) || undefined
    const files = formData.getAll('document')
    for (const file of files) {
      if (file instanceof File && file.size > 0) {
        uploadedFiles.push(file)
      }
    }
  } else {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body: malformed JSON' }, { status: 400 })
    }
    const body = rawBody as Record<string, unknown>
    newStatus = body.status as string | undefined
    completionNotes = body.completionNotes as string | undefined
    followUpNotes = body.followUpNotes as string | undefined
  }

  if (!newStatus || !Object.values(BriefStatus).includes(newStatus as BriefStatus)) {
    return NextResponse.json(
      { error: 'status is required and must be a valid BriefStatus' },
      { status: 422 },
    )
  }

  if (
    newStatus !== BriefStatus.IN_PROGRESS &&
    newStatus !== BriefStatus.COMPLETED
  ) {
    return NextResponse.json(
      { error: 'Only IN_PROGRESS and COMPLETED transitions are allowed' },
      { status: 422 },
    )
  }

  if (newStatus === BriefStatus.COMPLETED) {
    if (completionNotes && completionNotes.trim().length > 0 && completionNotes.trim().length < 20) {
      return NextResponse.json(
        { error: 'completionNotes must be at least 20 characters when provided' },
        { status: 422 },
      )
    }
  }

  if (uploadedFiles.length > 0) {
    for (const file of uploadedFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the 20 MB limit` },
          { status: 400 },
        )
      }
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `File type "${ext}" is not supported` },
          { status: 400 },
        )
      }
    }
  }

  try {
    const allocation = await prisma.allocation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        staffId: true,
        isActive: true,
        briefId: true,
        brief: {
          select: { status: true, referenceNumber: true, subject: true },
        },
      },
    })

    if (!allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }

    // SECURITY: Prevent counsel from accessing another counsel's allocation
    if (allocation.staffId !== staffId) {
      return NextResponse.json(
        { error: 'Forbidden: this allocation does not belong to you' },
        { status: 403 },
      )
    }

    if (!allocation.isActive) {
      return NextResponse.json(
        { error: 'Allocation is no longer active' },
        { status: 422 },
      )
    }

    if (
      allocation.brief.status === BriefStatus.COMPLETED ||
      allocation.brief.status === BriefStatus.CLOSED
    ) {
      return NextResponse.json(
        { error: `Brief is already ${allocation.brief.status}` },
        { status: 422 },
      )
    }

    const allowed = ALLOWED_TRANSITIONS[allocation.brief.status]
    if (!allowed || !allowed.includes(newStatus as BriefStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from ${allocation.brief.status} to ${newStatus}` },
        { status: 422 },
      )
    }

    const previousStatus = allocation.brief.status

    type SavedFileInfo = { fileName: string; storedName: string; fileType: string; fileSize: number }
    const savedFiles: SavedFileInfo[] = []

    for (const file of uploadedFiles) {
      const ext = path.extname(file.name) || ''
      const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
      const uploadDir = path.join(process.cwd(), 'uploads', 'completions', allocation.id)
      await mkdir(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, storedName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      savedFiles.push({
        fileName: file.name,
        storedName,
        fileType: file.type,
        fileSize: file.size,
      })
    }

    const notesPayload: Record<string, unknown> = {
      completionNotes: completionNotes?.trim() || null,
      followUpNotes: followUpNotes?.trim() || null,
    }
    if (savedFiles.length > 0) {
      notesPayload.uploadedFiles = savedFiles
      notesPayload.uploadedFile = savedFiles[0]
    }

    const notesJson = newStatus === BriefStatus.COMPLETED
      ? JSON.stringify(notesPayload)
      : undefined

    await prisma.brief.update({
      where: { id: allocation.briefId },
      data: { status: newStatus as BriefStatus },
    })

    if (notesJson) {
      await prisma.allocation.update({
        where: { id: allocation.id },
        data: { notes: notesJson },
      })
    }

    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.BRIEF_STATUS_CHANGED,
        actorId: session.user.id,
        briefId: allocation.briefId,
        allocationId: allocation.id,
        staffId,
        payload: {
          previousStatus,
          newStatus,
          referenceNumber: allocation.brief.referenceNumber,
          subject: allocation.brief.subject,
          ...(newStatus === BriefStatus.COMPLETED
            ? {
                completionNotes: completionNotes?.trim() || null,
                followUpNotes: followUpNotes?.trim() || null,
                uploadedFiles: savedFiles.length > 0
                  ? savedFiles.map((f) => ({ fileName: f.fileName, fileType: f.fileType, fileSize: f.fileSize }))
                  : null,
              }
            : {}),
        },
      },
    })

    // ── Fire completion email (non-blocking) ─────────────────────────────────────
    // Only fires on the COMPLETED transition, not IN_PROGRESS.
    // Fetches all DSG users and sends each an email out-of-band so
    // the HTTP response is never delayed by email delivery.
    if (newStatus === BriefStatus.COMPLETED) {
      const dsgUsers = await prisma.user.findMany({
        where: { role: 'DSG', deletedAt: null },
        select: { email: true, name: true },
      })

      for (const dsg of dsgUsers) {
        sendBriefCompletionEmail({
          to: dsg.email,
          dsgName: dsg.name ?? 'DSG',
          counselName: session.user.name ?? 'Counsel',
          briefRef: allocation.brief.referenceNumber,
          subject: allocation.brief.subject,
          completionNotes: completionNotes?.trim() || 'No notes provided.',
          documentReference: savedFiles.length > 0 ? savedFiles.map((f) => f.fileName).join(', ') : undefined,
        }).catch((err) => console.error('[EMAIL] sendBriefCompletionEmail error:', err))
      }
    }

    return NextResponse.json(
      {
        success: true,
        allocationId: params.id,
        previousStatus,
        newStatus,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[PATCH /api/me/allocations/:id/status] Error:', error)
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 })
  }
}
