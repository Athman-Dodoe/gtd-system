import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

// This is the EDGE-SAFE config — no Prisma, no Node.js-only imports.
// It is used exclusively by middleware.ts for session validation at the edge.
// The full auth config (with PrismaAdapter) lives in src/server/auth.ts.
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  providers: [
    // We include Credentials here only to satisfy NextAuth's config schema.
    // The actual `authorize` logic lives in the full auth.ts — it never
    // runs in the edge middleware path.
    Credentials({}),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.staffId = user.staffId
        token.mustChangePassword = user.mustChangePassword
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.staffId = token.staffId
        session.user.mustChangePassword = token.mustChangePassword
      }
      return session
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const role = auth?.user?.role
      const pathname = nextUrl.pathname

      // Public routes: always allow
      if (pathname.startsWith('/api/auth') || pathname === '/login') {
        // Redirect already-authenticated users away from login
        if (isLoggedIn && pathname === '/login') {
          const dest = role === 'DSG' ? '/dashboard' : '/my-work'
          return Response.redirect(new URL(dest, nextUrl))
        }
        return true
      }

      // All other routes require authentication
      if (!isLoggedIn) {
        return false // NextAuth will redirect to /login automatically
      }

      // Role-based route guards
      const isDsgRoute =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/briefs') ||
        pathname.startsWith('/queue') ||
        pathname.startsWith('/staff') ||
        pathname.startsWith('/reports') ||
        (pathname.startsWith('/api') && !pathname.startsWith('/api/me') && !pathname.startsWith('/api/uploads'))

      const isCounselRoute = pathname.startsWith('/my-work')

      if (isDsgRoute && role !== 'DSG') {
        return Response.redirect(new URL('/my-work', nextUrl))
      }

      if (isCounselRoute && role !== 'COUNSEL') {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      // Root redirect
      if (pathname === '/') {
        const dest = role === 'DSG' ? '/dashboard' : '/my-work'
        return Response.redirect(new URL(dest, nextUrl))
      }

      return true
    },
  },
} satisfies NextAuthConfig