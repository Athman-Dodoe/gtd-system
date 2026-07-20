import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding test users...');
  const hash1 = bcrypt.hashSync('password123', 10);
  
  await prisma.user.upsert({
    where: { email: 'counsel@ag.go.ke' },
    update: { passwordHash: hash1, role: 'COUNSEL', mustChangePassword: false },
    create: { email: 'counsel@ag.go.ke', name: 'Test Counsel', role: 'COUNSEL', passwordHash: hash1, mustChangePassword: false }
  });

  await prisma.user.upsert({
    where: { email: 'dsg@ag.go.ke' },
    update: { passwordHash: hash1, role: 'DSG', mustChangePassword: false },
    create: { email: 'dsg@ag.go.ke', name: 'Test DSG', role: 'DSG', passwordHash: hash1, mustChangePassword: false }
  });

  const hash2 = bcrypt.hashSync('temp123', 10);
  await prisma.user.upsert({
    where: { email: 'newuser@ag.go.ke' },
    update: { passwordHash: hash2, role: 'COUNSEL', mustChangePassword: true },
    create: { email: 'newuser@ag.go.ke', name: 'New User', role: 'COUNSEL', passwordHash: hash2, mustChangePassword: true }
  });

  console.log('Test users seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
