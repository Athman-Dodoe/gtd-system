import { NextRequest } from 'next/server'
import { handlers } from '@/server/auth'
import { signInLimiter } from '@/server/rate-limiter'

const { GET, POST: originalPOST } = handlers

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  try {
    await signInLimiter.consume(ip)
  } catch {
    return Response.json(
      { error: 'Too many attempts. Please try again later.', retryAfter: 900 },
      { status: 429 },
    )
  }

  return originalPOST(req)
}

export { GET }
