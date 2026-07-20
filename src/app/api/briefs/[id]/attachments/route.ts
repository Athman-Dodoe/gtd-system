import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { requireDSG } from '@/server/middleware/requireDSG'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
])

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png',
])

function sanitizeFileName(name: string): string {
  const ext = path.extname(name).toLowerCase()
  const base = path.basename(name, ext)
    .replace(/[^a-zA-Z0-9.\-_ ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 100)
  return `${crypto.randomUUID()}_${base}${ext}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may upload attachments' },
      { status: 403 },
    )
  }

  const { id: briefId } = await params

  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    select: { id: true },
  })

  if (!brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'briefs', briefId)
  await mkdir(uploadDir, { recursive: true })

  const created: {
    id: string
    fileName: string
    fileType: string
    fileSize: number
    storedPath: string
  }[] = []

  try {
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 20 MB limit` },
          { status: 422 },
        )
      }

      const ext = path.extname(file.name).toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `File type "${ext}" is not allowed` },
          { status: 422 },
        )
      }

      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `MIME type "${file.type}" is not allowed` },
          { status: 422 },
        )
      }

      const safeName = sanitizeFileName(file.name)
      const filePath = path.join(uploadDir, safeName)

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      try {
        const record = await prisma.briefAttachment.create({
          data: {
            briefId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            storedPath: safeName,
            uploadedById: session.user.id,
          },
          select: {
            id: true,
            fileName: true,
            fileType: true,
            fileSize: true,
            storedPath: true,
          },
        })
        created.push(record)
      } catch (dbError) {
        await unlink(filePath).catch(() => {})
        throw dbError
      }
    }
  } catch (error) {
    console.error('Failed to upload attachments:', error)
    return NextResponse.json(
      { error: 'An internal error occurred' },
      { status: 500 },
    )
  }

  return NextResponse.json(created, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireDSG()
  if (authError) return authError

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'DSG') {
    return NextResponse.json(
      { error: 'Forbidden: only DSG users may delete attachments' },
      { status: 403 },
    )
  }

  const { id: briefId } = await params

  let body: { attachmentIds?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.attachmentIds?.length) {
    return NextResponse.json({ error: 'No attachment IDs provided' }, { status: 400 })
  }

  const attachments = await prisma.briefAttachment.findMany({
    where: {
      id: { in: body.attachmentIds },
      briefId,
    },
    select: {
      id: true,
      storedPath: true,
    },
  })

  if (!attachments.length) {
    return NextResponse.json({ error: 'No matching attachments found' }, { status: 404 })
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'briefs', briefId)

  for (const att of attachments) {
    const filePath = path.join(uploadDir, att.storedPath)
    await unlink(filePath).catch(() => {})
  }

  await prisma.briefAttachment.deleteMany({
    where: {
      id: { in: attachments.map((a) => a.id) },
    },
  })

  return NextResponse.json({ deleted: attachments.length })
}
