import { prisma } from './src/server/db'

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'jacqueline.muindi@ag.go.ke' },
  })
  console.log('User:', user)
  await prisma.$disconnect()
}

main().catch(console.error)