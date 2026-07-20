import { NextResponse } from 'next/server'
import { auth } from '@/server/auth'

export async function requireDSG(): Promise<NextResponse | null> {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'DSG') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
