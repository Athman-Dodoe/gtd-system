import { DefaultSession } from 'next-auth'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { JWT } from 'next-auth/jwt'
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      staffId?: string | null
      mustChangePassword?: boolean
    } & DefaultSession['user']
  }

  interface User {
    id?: string
    role: UserRole
    staffId?: string | null
    mustChangePassword?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    staffId?: string | null
    mustChangePassword?: boolean
  }
}
