import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/server/auth'
import { prisma } from '@/server/db'
import bcrypt from 'bcryptjs'
import { changePasswordLimiter } from '@/server/rate-limiter'

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await changePasswordLimiter.consume(session.user.id)
  } catch {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.', retryAfter: 3600 },
      { status: 429 },
    )
  }

  let body: { newPassword: string; confirmPassword: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { newPassword, confirmPassword } = body

  if (!newPassword || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'New password is required' }, { status: 400 })
  }
  if (!confirmPassword || typeof confirmPassword !== 'string') {
    return NextResponse.json({ error: 'Confirm password is required' }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (!/[A-Za-z]/.test(newPassword)) {
    return NextResponse.json({ error: 'Password must contain at least one letter' }, { status: 400 })
  }
  if (!/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: 'Password must contain at least one number' }, { status: 400 })
  }

  try {
    const hash = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: hash,
        mustChangePassword: false,
      },
    })

    const response = NextResponse.json(
      { success: true, message: 'Password updated. Please log in again.' },
      { status: 200 }
    )

    // Clear the session cookie to force re-authentication
    response.cookies.delete('next-auth.session-token')
    response.cookies.delete('__Secure-next-auth.session-token')

    return response
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}