import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/server/db'
import { resetPasswordLimiter } from '@/server/rate-limiter'

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  try {
    await resetPasswordLimiter.consume(ip)
  } catch {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.', retryAfter: 3600 },
      { status: 429 },
    )
  }

  let body: { token: string; newPassword: string; confirmPassword: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token, newPassword, confirmPassword } = body

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }
  if (!newPassword || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'New password is required' }, { status: 400 })
  }
  if (!confirmPassword || typeof confirmPassword !== 'string') {
    return NextResponse.json({ error: 'Confirm password is required' }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
  }

  // Password strength validation
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/[A-Z]/.test(newPassword)) {
    return NextResponse.json({ error: 'Password must contain at least one uppercase letter' }, { status: 400 })
  }
  if (!/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: 'Password must contain at least one number' }, { status: 400 })
  }
  if (!/[!@#$%^&*]/.test(newPassword)) {
    return NextResponse.json(
      { error: 'Password must contain at least one special character (!@#$%^&*)' },
      { status: 400 }
    )
  }

  // Hash the incoming token to match against the stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: hashedToken },
  })

  if (!verificationToken) {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  if (new Date() > verificationToken.expires) {
    // Clean up expired token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: verificationToken.identifier, token: hashedToken } },
    })
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  // Find the user by email (identifier)
  const user = await prisma.user.findUnique({
    where: { email: verificationToken.identifier },
    select: { id: true, email: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
  }

  // Hash the new password and update the user
  const hash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        mustChangePassword: false,
      },
    })
    await tx.verificationToken.delete({
      where: { identifier_token: { identifier: verificationToken.identifier, token: hashedToken } },
    })
    await tx.auditLog.create({
      data: {
        eventType: 'PASSWORD_RESET_COMPLETED',
        actorId: user.id,
        payload: { email: user.email },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null,
        userAgent: req.headers.get('user-agent') ?? null,
      },
    })
  })

  return NextResponse.json({ success: true, message: 'Password updated successfully. You can now login using the new password.' })
}
