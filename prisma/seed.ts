import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, SeniorityLevel, ExpertiseArea, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('***REDACTED***', 10)

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

type CounselSeedData = {
  name: string
  email: string
  employeeNumber: string
  designation: string
  seniority: SeniorityLevel
  dateJoined: Date
  primaryArea: ExpertiseArea
  secondaryAreas: ExpertiseArea[]
}

// =============================================================================
// DSG ACCOUNT — Jacqueline Mbithe Muindi
// Role: DSG (full system admin). NOT in the allocation pool.
// No Staff record is created for the DSG.
// =============================================================================

const DSG_USER = {
   name: 'Jacqueline Mbithe Muindi',
   email: 'jacqueline.muindi@ag.go.ke',
   role: UserRole.DSG
 }

// =============================================================================
// COUNSEL ROSTER (22 staff members)
//
// Primary area distribution (4-4-4-4-3-3):
//   PUBLIC_PROCUREMENT_CONTRACTS  → 4  (Peter, Ashley, Angela, Eunice)
//   FINANCING_AGREEMENTS          → 4  (Sharon, Irene, Mercy, Daniel)
//   PPP_PROJECT_AGREEMENTS        → 4  (Nevis, Barbara, Sharleen, Cynthia)
//   MEMORANDA_OF_UNDERSTANDING    → 4  (Joy, Rachel, Valerie, Jedidah)
//   CABINET_MEMORANDA             → 3  (Catherine, Kenneth, Caren)
//   GENERAL_LEGAL_ADVISORY        → 3  (Abigael, Silvia, Magdaline)
//
// Each counsel also has 1–2 secondary areas to reflect real-world
// cross-functional capability. The DSG can refine all assignments
// post-launch via the admin UI.
// =============================================================================

const COUNSEL_DATA: CounselSeedData[] = [
  // ─── DEPUTY CHIEF STATE COUNSEL (4) ─────────────────────────────────────────

  {
    name: 'Peter Okombe Ongori',
    email: 'peter.ongori@ag.go.ke',
    employeeNumber: 'GTD-001',
    designation: 'Deputy Chief State Counsel',
    seniority: SeniorityLevel.DEPUTY_CHIEF,
    dateJoined: new Date('2005-03-01'),
    primaryArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    secondaryAreas: [
      ExpertiseArea.FINANCING_AGREEMENTS,
      ExpertiseArea.GENERAL_LEGAL_ADVISORY,
    ],
  },
  {
    name: 'Sharon Gatwiri Irungu-Asiyo',
    email: 'sharon.irungu@ag.go.ke',
    employeeNumber: 'GTD-002',
    designation: 'Deputy Chief State Counsel',
    seniority: SeniorityLevel.DEPUTY_CHIEF,
    dateJoined: new Date('2006-07-01'),
    primaryArea: ExpertiseArea.FINANCING_AGREEMENTS,
    secondaryAreas: [
      ExpertiseArea.PPP_PROJECT_AGREEMENTS,
      ExpertiseArea.MEMORANDA_OF_UNDERSTANDING,
    ],
  },
  {
    name: 'Nevis Obino Ombasa',
    email: 'nevis.ombasa@ag.go.ke',
    employeeNumber: 'GTD-003',
    designation: 'Deputy Chief State Counsel',
    seniority: SeniorityLevel.DEPUTY_CHIEF,
    dateJoined: new Date('2007-01-15'),
    primaryArea: ExpertiseArea.PPP_PROJECT_AGREEMENTS,
    secondaryAreas: [
      ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
      ExpertiseArea.CABINET_MEMORANDA,
    ],
  },
  {
    name: 'Joy Wanjugu Maina',
    email: 'joy.maina@ag.go.ke',
    employeeNumber: 'GTD-004',
    designation: 'Deputy Chief State Counsel',
    seniority: SeniorityLevel.DEPUTY_CHIEF,
    dateJoined: new Date('2008-04-01'),
    primaryArea: ExpertiseArea.MEMORANDA_OF_UNDERSTANDING,
    secondaryAreas: [
      ExpertiseArea.CABINET_MEMORANDA,
      ExpertiseArea.GENERAL_LEGAL_ADVISORY,
    ],
  },

  // ─── PRINCIPAL STATE COUNSEL (9) ─────────────────────────────────────────────

  {
    name: 'Ashley Simiyu Toywa',
    email: 'ashley.toywa@ag.go.ke',
    employeeNumber: 'GTD-005',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2010-09-01'),
    primaryArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    secondaryAreas: [ExpertiseArea.GENERAL_LEGAL_ADVISORY],
  },
  {
    name: 'Irene Achieng Okwach',
    email: 'irene.okwach@ag.go.ke',
    employeeNumber: 'GTD-006',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2011-02-14'),
    primaryArea: ExpertiseArea.FINANCING_AGREEMENTS,
    secondaryAreas: [ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS],
  },
  {
    name: 'Barbara Wangari Nguyu',
    email: 'barbara.nguyu@ag.go.ke',
    employeeNumber: 'GTD-007',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2011-06-01'),
    primaryArea: ExpertiseArea.PPP_PROJECT_AGREEMENTS,
    secondaryAreas: [ExpertiseArea.MEMORANDA_OF_UNDERSTANDING],
  },
  {
    name: "Rachel Wanjiku Ndung'u",
    email: 'rachael.wanjiku@ag.go.ke',
    employeeNumber: 'GTD-008',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2012-01-09'),
    primaryArea: ExpertiseArea.MEMORANDA_OF_UNDERSTANDING,
    secondaryAreas: [ExpertiseArea.CABINET_MEMORANDA],
  },
  {
    name: 'Catherine Someren',
    email: 'catherine.someren@ag.go.ke',
    employeeNumber: 'GTD-009',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2012-08-01'),
    primaryArea: ExpertiseArea.CABINET_MEMORANDA,
    secondaryAreas: [ExpertiseArea.GENERAL_LEGAL_ADVISORY],
  },
  {
    name: "Kenneth Kikwai Kipng'enoh",
    email: 'kenneth.kikwai@ag.go.ke',
    employeeNumber: 'GTD-010',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2013-03-01'),
    primaryArea: ExpertiseArea.CABINET_MEMORANDA,
    secondaryAreas: [ExpertiseArea.MEMORANDA_OF_UNDERSTANDING],
  },
  {
    name: 'Abigael Khakasa Masinde',
    email: 'abigael.masinde@ag.go.ke',
    employeeNumber: 'GTD-011',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2013-07-01'),
    primaryArea: ExpertiseArea.GENERAL_LEGAL_ADVISORY,
    secondaryAreas: [ExpertiseArea.FINANCING_AGREEMENTS],
  },
  {
    name: 'Silvia Wambui Kanyi',
    email: 'silvia.kanyi@ag.go.ke',
    employeeNumber: 'GTD-012',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2014-01-13'),
    primaryArea: ExpertiseArea.GENERAL_LEGAL_ADVISORY,
    secondaryAreas: [ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS],
  },
  {
    name: 'Magdaline Wachira',
    email: 'magdaline.wachira@ag.go.ke',
    employeeNumber: 'GTD-013',
    designation: 'Principal State Counsel',
    seniority: SeniorityLevel.PRINCIPAL,
    dateJoined: new Date('2014-05-05'),
    primaryArea: ExpertiseArea.GENERAL_LEGAL_ADVISORY,
    secondaryAreas: [ExpertiseArea.PPP_PROJECT_AGREEMENTS],
  },

  // ─── SENIOR STATE COUNSEL (9) ────────────────────────────────────────────────

  {
    name: 'Angela Waruguru Kariuki',
    email: 'angela.waruguru@ag.go.ke',
    employeeNumber: 'GTD-014',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2015-08-01'),
    primaryArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    secondaryAreas: [ExpertiseArea.GENERAL_LEGAL_ADVISORY],
  },
  {
    name: 'Eunice Mary Njau',
    email: 'eunice.njau@ag.go.ke',
    employeeNumber: 'GTD-015',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2016-02-01'),
    primaryArea: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    secondaryAreas: [ExpertiseArea.FINANCING_AGREEMENTS],
  },
  {
    name: 'Mercy Cherotich',
    email: 'mercy.cherotich@ag.go.ke',
    employeeNumber: 'GTD-016',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2016-07-11'),
    primaryArea: ExpertiseArea.FINANCING_AGREEMENTS,
    secondaryAreas: [ExpertiseArea.PPP_PROJECT_AGREEMENTS],
  },
  {
    name: 'Daniel Gichimu Wambugu',
    email: 'wambugu.daniel@ag.go.ke',
    employeeNumber: 'GTD-017',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2017-01-09'),
    primaryArea: ExpertiseArea.FINANCING_AGREEMENTS,
    secondaryAreas: [ExpertiseArea.MEMORANDA_OF_UNDERSTANDING],
  },
  {
    name: 'Sharleen Oyiera Okwara',
    email: 'sharleen.oyiera@ag.go.ke',
    employeeNumber: 'GTD-018',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2017-09-04'),
    primaryArea: ExpertiseArea.PPP_PROJECT_AGREEMENTS,
    secondaryAreas: [ExpertiseArea.MEMORANDA_OF_UNDERSTANDING],
  },
  {
    name: 'Cynthia Jelagat Koech',
    email: 'cynthia.koech@ag.go.ke',
    employeeNumber: 'GTD-019',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2018-03-01'),
    primaryArea: ExpertiseArea.PPP_PROJECT_AGREEMENTS,
    secondaryAreas: [ExpertiseArea.CABINET_MEMORANDA],
  },
  {
    name: 'Valerie Karuwa Wabungo',
    email: 'valerie.wabungo@ag.go.ke',
    employeeNumber: 'GTD-020',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2018-09-03'),
    primaryArea: ExpertiseArea.MEMORANDA_OF_UNDERSTANDING,
    secondaryAreas: [ExpertiseArea.FINANCING_AGREEMENTS],
  },
  {
    name: 'Jedidah Silantoi Leriano',
    email: 'jedidah.silantoi@ag.go.ke',
    employeeNumber: 'GTD-021',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2019-05-06'),
    primaryArea: ExpertiseArea.MEMORANDA_OF_UNDERSTANDING,
    secondaryAreas: [ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS],
  },
  {
    name: 'Caren Amaseh Okiru',
    email: 'caren.okiru@ag.go.ke',
    employeeNumber: 'GTD-022',
    designation: 'Senior State Counsel',
    seniority: SeniorityLevel.SENIOR,
    dateJoined: new Date('2020-01-20'),
    primaryArea: ExpertiseArea.CABINET_MEMORANDA,
    secondaryAreas: [ExpertiseArea.GENERAL_LEGAL_ADVISORY],
  },
]

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function main() {
  console.log('🌱 Starting database seed...\n')
  console.log('── Step 1 of 2: DSG User ──────────────────────────────────────')

  // ── 1. DSG user ─────────────────────────────────────────────────────────────
  // No Staff or StaffExpertise record for the DSG — she is not in the
  // allocation pool.

const dsgUser = await prisma.user.upsert({
     where: { email: DSG_USER.email },
     update: {
       name: DSG_USER.name,
       role: DSG_USER.role,
       passwordHash: DEFAULT_PASSWORD_HASH,
     },
     create: {
       name: DSG_USER.name,
       email: DSG_USER.email,
       role: DSG_USER.role,
       passwordHash: DEFAULT_PASSWORD_HASH,
     },
   })

  console.log(`✅  ${dsgUser.name} (DSG)`)

  // ── 2. Counsel ───────────────────────────────────────────────────────────────
  console.log('\n── Step 2 of 2: Counsel (User + Staff + Expertise) ───────────')

  for (const counsel of COUNSEL_DATA) {
// 2a. Upsert User record
const user = await prisma.user.upsert({
      where: { email: counsel.email },
      update: {
        name: counsel.name,
        role: UserRole.COUNSEL,
        passwordHash: DEFAULT_PASSWORD_HASH,
      },
      create: {
        name: counsel.name,
        email: counsel.email,
        role: UserRole.COUNSEL,
        passwordHash: DEFAULT_PASSWORD_HASH,
      },
    })

    // 2b. Upsert Staff record
    // On update we do NOT overwrite employeeNumber or dateJoined —
    // those are immutable after creation.
    const staff = await prisma.staff.upsert({
      where: { email: counsel.email },
      update: {
        fullName: counsel.name,
        designation: counsel.designation,
        seniority: counsel.seniority,
        userId: user.id,
        isActive: true,
      },
      create: {
        userId: user.id,
        employeeNumber: counsel.employeeNumber,
        fullName: counsel.name,
        designation: counsel.designation,
        email: counsel.email,
        seniority: counsel.seniority,
        isActive: true,
        dateJoined: counsel.dateJoined,
      },
    })

    // 2c. Upsert primary expertise area
    await prisma.staffExpertise.upsert({
      where: {
        staffId_expertiseArea: {
          staffId: staff.id,
          expertiseArea: counsel.primaryArea,
        },
      },
      update: { isPrimary: true },
      create: {
        staffId: staff.id,
        expertiseArea: counsel.primaryArea,
        isPrimary: true,
      },
    })

    // 2d. Upsert secondary expertise areas
    for (const area of counsel.secondaryAreas) {
      await prisma.staffExpertise.upsert({
        where: {
          staffId_expertiseArea: {
            staffId: staff.id,
            expertiseArea: area,
          },
        },
        update: { isPrimary: false },
        create: {
          staffId: staff.id,
          expertiseArea: area,
          isPrimary: false,
        },
      })
    }

    const allAreas = [counsel.primaryArea, ...counsel.secondaryAreas].join(', ')
    console.log(
      `✅  [${counsel.employeeNumber}] ${counsel.name.padEnd(34)} ${counsel.seniority.padEnd(13)} → ${allAreas}`,
    )
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════')
  console.log('✅  Seed completed.')
  console.log(`    1  DSG user`)
  console.log(`    ${COUNSEL_DATA.length}  counsel (User + Staff + Expertise)`)
  console.log(`    ${COUNSEL_DATA.reduce((acc, c) => acc + 1 + c.secondaryAreas.length, 0)}  StaffExpertise rows`)
  console.log('══════════════════════════════════════════════════════════════\n')
}

main()
  .catch((error) => {
    console.error('\n❌ Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
