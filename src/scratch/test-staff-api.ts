// =============================================================================
// Scratch Test — Staff Management API
// =============================================================================
// Run with:  npx tsx src/scratch/test-staff-api.ts
//
// Requires an existing database with seed data loaded (npm run db:seed).
//
// Test flow:
//   1. List all staff — verify at least 22 counsel returned
//   2. Get single staff profile — verify allocations, expertise, workload
//   3. Update seniority — verify PATCH response reflects change
//   4. Update expertise areas — verify old areas replaced atomically
//   5. Deactivate a counsel — verify isActive=false + audit log
//   6. Reactivate counsel — verify isActive=true
//   7. Get workload history — verify daily records exist and are ordered
// =============================================================================

import 'dotenv/config'
import { prisma } from '../server/db'
import {
  listStaff,
  getStaffProfile,
  updateStaff,
  getStaffWorkloadHistory,
} from '../server/services/staff.service'
import {
  SeniorityLevel,
  ExpertiseArea,
  AuditEventType,
} from '@prisma/client'

// ── Helpers ────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures: string[] = []

function assert(label: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  ✅  ${label}`)
  } else {
    failed++
    failures.push(label)
    console.log(`  ❌  ${label}`)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════')
  console.log('  Staff Management API Integration Test')
  console.log('══════════════════════════════════════════════════════════════\n')

  // ── Step 0: Fetch actors ───────────────────────────────────────────────
  console.log('── [0] Fetch actors ────────────────────────────────────────')

  const dsgUser = await prisma.user.findUnique({
    where: { email: 'jacqueline.muindi@ag.go.ke' },
  })
  assert('DSG user found (jacqueline.muindi@ag.go.ke)', !!dsgUser)
  if (!dsgUser) {
    console.error('Seed data not found — run npm run db:seed first.')
    process.exit(1)
  }

  // ── Step 1: List all staff ─────────────────────────────────────────────
  console.log('\n── [1] List all staff ──────────────────────────────────────')

  const allStaff = await listStaff()
  assert('listStaff returns an array', Array.isArray(allStaff))
  assert('listStaff returns at least 22 counsel', allStaff.length >= 22)
  assert('Each staff has fullName', allStaff.every((s) => !!s.fullName))
  assert('Each staff has employeeNumber', allStaff.every((s) => !!s.employeeNumber))
  assert('Each staff has seniority', allStaff.every((s) => !!s.seniority))
  assert('Each staff has expertiseAreas array', allStaff.every((s) => Array.isArray(s.expertiseAreas)))
  assert('Each staff has today object', allStaff.every((s) => s.today !== undefined))
  assert('today has hoursAllocated number', allStaff.every((s) => typeof s.today.hoursAllocated === 'number'))
  assert('today has briefCount number', allStaff.every((s) => typeof s.today.briefCount === 'number'))

  // Pick a counsel with public procurement expertise
  const targetCounsel = allStaff.find((s) =>
    s.expertiseAreas.some(
      (e) => e.expertiseArea === ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS && e.isPrimary,
    ),
  )
  assert('Found counsel with PUBLIC_PROCUREMENT_CONTRACTS primary', !!targetCounsel)
  if (!targetCounsel) {
    console.error('No matching counsel found.')
    process.exit(1)
  }
  console.log(`  ℹ️   Target counsel: ${targetCounsel.fullName} (${targetCounsel.id})`)

  // ── Step 2: Get single staff profile ───────────────────────────────────
  console.log('\n── [2] Get single staff profile ────────────────────────────')

  const profile = await getStaffProfile(targetCounsel.id)
  assert('Profile has fullName matching', profile.fullName === targetCounsel.fullName)
  assert('Profile has email', !!profile.email)
  assert('Profile has dateJoined', !!profile.dateJoined)
  assert('Profile has expertiseAreas', profile.expertiseAreas.length > 0)
  assert('Profile has today workload', profile.today !== undefined)
  assert('Profile has allocations array', Array.isArray(profile.allocations))

  // ── Step 3: Update seniority ───────────────────────────────────────────
  console.log('\n── [3] Update seniority ────────────────────────────────────')

  const originalSeniority = profile.seniority
  const newSeniority =
    originalSeniority === SeniorityLevel.SENIOR
      ? SeniorityLevel.PRINCIPAL
      : SeniorityLevel.SENIOR

  const updatedProfile = await updateStaff(targetCounsel.id, dsgUser.id, {
    seniority: newSeniority,
  })
  assert(`Seniority changed from ${originalSeniority} to ${newSeniority}`, updatedProfile.seniority === newSeniority)

  // Verify DB directly
  const verifySeniority = await prisma.staff.findUnique({
    where: { id: targetCounsel.id },
    select: { seniority: true },
  })
  assert(`DB seniority is ${newSeniority}`, verifySeniority?.seniority === newSeniority)

  // Verify audit log
  const auditSeniority = await prisma.auditLog.findFirst({
    where: {
      staffId: targetCounsel.id,
      eventType: AuditEventType.STAFF_UPDATED,
    },
    orderBy: { occurredAt: 'desc' },
  })
  assert('AuditLog: STAFF_UPDATED created for seniority change', !!auditSeniority)
  assert('AuditLog payload includes seniority', (auditSeniority?.payload as Record<string, unknown>)?.seniority === newSeniority)

  // Restore original seniority
  await updateStaff(targetCounsel.id, dsgUser.id, { seniority: originalSeniority })
  const restoredSeniority = await prisma.staff.findUnique({
    where: { id: targetCounsel.id },
    select: { seniority: true },
  })
  assert(`Seniority restored to ${originalSeniority}`, restoredSeniority?.seniority === originalSeniority)

  // ── Step 4: Update expertise areas ─────────────────────────────────────
  console.log('\n── [4] Update expertise areas ──────────────────────────────')

  await updateStaff(targetCounsel.id, dsgUser.id, {
    expertiseAreas: {
      primary: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
      secondary: [ExpertiseArea.GENERAL_LEGAL_ADVISORY, ExpertiseArea.FINANCING_AGREEMENTS],
    },
  })

  const verifyExpertise = await prisma.staffExpertise.findMany({
    where: { staffId: targetCounsel.id },
    orderBy: { isPrimary: 'desc' },
  })
  assert('Primary expertise is PUBLIC_PROCUREMENT_CONTRACTS',
    verifyExpertise.some((e) => e.expertiseArea === ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS && e.isPrimary))
  assert('Secondary expertise includes GENERAL_LEGAL_ADVISORY',
    verifyExpertise.some((e) => e.expertiseArea === ExpertiseArea.GENERAL_LEGAL_ADVISORY && !e.isPrimary))
  assert('Secondary expertise includes FINANCING_AGREEMENTS',
    verifyExpertise.some((e) => e.expertiseArea === ExpertiseArea.FINANCING_AGREEMENTS && !e.isPrimary))
  assert('Exactly 3 expertise rows', verifyExpertise.length === 3)

  // Restore minimal expertise set
  await updateStaff(targetCounsel.id, dsgUser.id, {
    expertiseAreas: {
      primary: ExpertiseArea.PUBLIC_PROCUREMENT_CONTRACTS,
    },
  })
  const restoredExpertise = await prisma.staffExpertise.findMany({
    where: { staffId: targetCounsel.id },
  })
  assert('Expertise restored to 1 row', restoredExpertise.length === 1)
  assert('Only primary remains', restoredExpertise[0].isPrimary === true)

  // ── Step 5: Deactivate a counsel ───────────────────────────────────────
  console.log('\n── [5] Deactivate counsel ──────────────────────────────────')

  await updateStaff(targetCounsel.id, dsgUser.id, { isActive: false })

  const verifyDeactivated = await prisma.staff.findUnique({
    where: { id: targetCounsel.id },
    select: { isActive: true },
  })
  assert('Counsel is now inactive', verifyDeactivated?.isActive === false)

  const auditDeactivate = await prisma.auditLog.findFirst({
    where: {
      staffId: targetCounsel.id,
      eventType: AuditEventType.STAFF_DEACTIVATED,
    },
    orderBy: { occurredAt: 'desc' },
  })
  assert('AuditLog: STAFF_DEACTIVATED created', !!auditDeactivate)

  // ── Step 6: Reactivate counsel ─────────────────────────────────────────
  console.log('\n── [6] Reactivate counsel ──────────────────────────────────')

  await updateStaff(targetCounsel.id, dsgUser.id, { isActive: true })

  const verifyReactivated = await prisma.staff.findUnique({
    where: { id: targetCounsel.id },
    select: { isActive: true },
  })
  assert('Counsel is active again', verifyReactivated?.isActive === true)

  const auditReactivate = await prisma.auditLog.findFirst({
    where: {
      staffId: targetCounsel.id,
      eventType: AuditEventType.STAFF_UPDATED,
    },
    orderBy: { occurredAt: 'desc' },
  })
  assert('AuditLog: STAFF_UPDATED created for reactivation', !!auditReactivate)

  // ── Step 7: Get workload history ───────────────────────────────────────
  console.log('\n── [7] Get workload history ────────────────────────────────')

  // Create some workload data first
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const twoDaysAgo = new Date(today)
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)

  await prisma.dailyWorkload.upsert({
    where: { staffId_workDate: { staffId: targetCounsel.id, workDate: twoDaysAgo } },
    update: {},
    create: { staffId: targetCounsel.id, workDate: twoDaysAgo, hoursAllocated: 3.0, briefCount: 2 },
  })
  await prisma.dailyWorkload.upsert({
    where: { staffId_workDate: { staffId: targetCounsel.id, workDate: yesterday } },
    update: {},
    create: { staffId: targetCounsel.id, workDate: yesterday, hoursAllocated: 6.0, briefCount: 4 },
  })
  await prisma.dailyWorkload.upsert({
    where: { staffId_workDate: { staffId: targetCounsel.id, workDate: today } },
    update: {},
    create: { staffId: targetCounsel.id, workDate: today, hoursAllocated: 2.0, briefCount: 1 },
  })

  const workloadHistory = await getStaffWorkloadHistory(targetCounsel.id, 10)
  assert('Workload history returns array', Array.isArray(workloadHistory))
  assert('Workload history has at least 3 entries', workloadHistory.length >= 3)
  assert('Workload entries are ordered by date descending',
    workloadHistory[0].workDate >= workloadHistory[1].workDate)
  assert('Workload entries have workDate', workloadHistory.every((w) => !!w.workDate))
  assert('Workload entries have hoursAllocated', workloadHistory.every((w) => typeof w.hoursAllocated === 'number'))
  assert('Workload entries have briefCount', workloadHistory.every((w) => typeof w.briefCount === 'number'))

  // Default limit is 30
  const defaultHistory = await getStaffWorkloadHistory(targetCounsel.id)
  assert('Default limit returns results', defaultHistory.length >= 3)

  // Max limit is 365
  const maxHistory = await getStaffWorkloadHistory(targetCounsel.id, 365)
  assert('Max limit 365 works', maxHistory.length >= 3)

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════')
  const total = passed + failed
  const passRate = ((passed / total) * 100).toFixed(1)
  console.log(`  Results: ${passed}/${total} passed (${passRate}%)`)
  if (failures.length > 0) {
    console.log('\n  Failures:')
    for (const f of failures) {
      console.log(`    • ${f}`)
    }
  }
  console.log('══════════════════════════════════════════════════════════════\n')

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\n❌ Test script failed:', error)
  process.exit(1)
})
