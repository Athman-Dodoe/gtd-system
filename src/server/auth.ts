import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/server/db'

export const { auth, handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          const email = credentials.email as string
          const password = credentials.password as string

          const user = await prisma.user.findUnique({
            where: { email },
            include: { staff: true },
          })

          if (!user || user.deletedAt) {
            return null
          }

          if (user.staff && !user.staff.isActive) return null

          if (!user.passwordHash) {
            return null
          }

          const passwordValid = await bcrypt.compare(password, user.passwordHash)
          if (!passwordValid) {
            return null
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            staffId: user.staff?.id || null,
            mustChangePassword: user.mustChangePassword,
          }
        } catch (error) {
          console.error('Auth authorize error:', error)
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        token.staffId = user.staffId
        token.mustChangePassword = user.mustChangePassword
        return token
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.staffId = token.staffId
        session.user.mustChangePassword = token.mustChangePassword
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})