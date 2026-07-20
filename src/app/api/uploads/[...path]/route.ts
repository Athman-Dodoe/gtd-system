import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import { readFile } from 'fs/promises'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const filePath = params.path.join('/')

  if (filePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const resolved = path.join(process.cwd(), 'uploads', filePath)
  const uploadsRoot = path.join(process.cwd(), 'uploads')

  if (!resolved.startsWith(uploadsRoot)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  if (params.path[0] === 'briefs' && params.path.length >= 2) {
    const briefId = params.path[1]
    const brief = await prisma.brief.findUnique({
      where: { id: briefId },
      select: { id: true },
    })
    if (!brief) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  if (params.path[0] === 'completions' && params.path.length >= 2) {
    const allocationId = params.path[1]
    const allocation = await prisma.allocation.findUnique({
      where: { id: allocationId },
      select: { id: true, staffId: true },
    })
    if (!allocation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (session.user.role !== 'DSG' && allocation.staffId !== session.user.staffId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const data = await readFile(resolved)
    const ext = path.extname(resolved).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
