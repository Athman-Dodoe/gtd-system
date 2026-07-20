import NextAuth from 'next-auth'
import { authConfig } from '@/server/auth.config'
import { NextResponse } from 'next/server'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  const isLoggedIn = !!session
  const mustChange = session?.user?.mustChangePassword
  const role = session?.user?.role

  const isChangePasswordPage = nextUrl.pathname === '/login/change-password'
  const isAuthPage = nextUrl.pathname.startsWith('/login')
  const isApiRoute = nextUrl.pathname.startsWith('/api')

  if (isApiRoute) return NextResponse.next()

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isLoggedIn && mustChange && !isChangePasswordPage) {
    return NextResponse.redirect(new URL('/login/change-password', req.url))
  }

  if (isLoggedIn && !mustChange && isAuthPage) {
    if (role === 'DSG') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.redirect(new URL('/my-work', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}