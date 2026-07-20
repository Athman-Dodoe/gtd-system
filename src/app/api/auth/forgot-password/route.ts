import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/server/db'
import { sendPasswordResetEmail } from '@/server/services/email.service'
import { forgotPasswordLimiter } from '@/server/rate-limiter'

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  try {
    await forgotPasswordLimiter.consume(ip)
  } catch {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.', retryAfter: 3600 },
      { status: 429 },
    )
  }

  let body: { email: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email } = body

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalised = email.trim().toLowerCase()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  if (!normalised.endsWith('@ag.go.ke')) {
    return NextResponse.json(
      { error: 'Only @ag.go.ke email addresses are permitted' },
      { status: 400 }
    )
  }

  // Always return the same message to prevent email enumeration
  const genericMessage = 'If an account with that email exists, a reset link has been sent.'

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true, name: true, email: true, deletedAt: true },
  })

  if (!user || user.deletedAt) {
    return NextResponse.json({ success: true, message: genericMessage })
  }

  // Generate a 32-byte CSPRNG token and its SHA-256 hash
  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')

  const expires = new Date(Date.now() + TOKEN_EXPIRY_MS)

  // Upsert: delete any existing token for this user, then create a new one
  await prisma.verificationToken.deleteMany({
    where: { identifier: normalised },
  })

  await prisma.verificationToken.create({
    data: {
      identifier: normalised,
      token: hashedToken,
      expires,
    },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const resetLink = `${appUrl}/login/reset-password?token=${rawToken}`

  // Fire-and-forget email
  sendPasswordResetEmail({
    to: normalised,
    userName: user.name ?? 'User',
    resetLink,
  }).catch((err) => console.error('[FORGOT-PASSWORD] Email send failed:', err))

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        eventType: 'PASSWORD_RESET_REQUESTED',
        actorId: user.id,
        payload: { email: normalised },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      },
    })
  } catch (err) {
    console.error('[FORGOT-PASSWORD] Audit log failed:', err)
  }

  return NextResponse.json({ success: true, message: genericMessage })
}
