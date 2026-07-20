import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    })
    return new PrismaClient({
      adapter: new PrismaPg(pool),
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    })
  })()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
