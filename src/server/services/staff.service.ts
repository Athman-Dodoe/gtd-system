import bcrypt from 'bcryptjs'
import { Prisma, SeniorityLevel, ExpertiseArea, AuditEventType, BriefStatus } from '@prisma/client'
import { prisma } from '@/server/db'

export class StaffConflictError extends Error {
  public readonly activeBriefs: { id: string; referenceNumber: string; subject: string }[]

  constructor(
    message: string,
    activeBriefs: { id: string; referenceNumber: string; subject: string }[],
  ) {
    super(message)
    this.name = 'StaffConflictError'
    this.activeBriefs = activeBriefs
  }
}

export interface StaffListItem {
  id: string
  employeeNumber: string
  fullName: string
  designation: string
  seniority: SeniorityLevel
  isActive: boolean
  dateJoined: Date
  expertiseAreas: { expertiseArea: ExpertiseArea; isPrimary: boolean }[]
  today: { hoursAllocated: number; briefCount: number }
}

export interface StaffProfile extends StaffListItem {
  email: string
  createdAt: Date
  updatedAt: Date
  allocations: {
    id: string
    briefId: string
    brief: { referenceNumber: string; subject: string }
    allocationMethod: string
    hoursAllocated: number
    allocatedAt: Date
    isActive: boolean
  }[]
}

export interface UpdateStaffInput {
  fullName?: string
  designation?: string
  email?: string
  seniority?: SeniorityLevel
  isActive?: boolean
  expertiseAreas?: {
    primary: ExpertiseArea
    secondary?: ExpertiseArea[]
  }
}

export interface CreateStaffInput {
  fullName: string
  email: string
  designation: string
  seniority: SeniorityLevel
  primaryExpertise: ExpertiseArea
  additionalExpertise: ExpertiseArea[]
  dateJoined: string
  employeeNumber: string
}

const DEFAULT_PASSWORD = process.env.DEFAULT_STAFF_PASSWORD ?? (() => { throw new Error('DEFAULT_STAFF_PASSWORD env variable is not set') })()

export async function createStaff(
  data: CreateStaffInput,
  actorId: string,
): Promise<StaffProfile> {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.fullName,
        email: data.email,
        role: 'COUNSEL',
        passwordHash,
        mustChangePassword: true,
      },
    })

    const staff = await tx.staff.create({
      data: {
        userId: user.id,
        employeeNumber: data.employeeNumber,
        fullName: data.fullName,
        designation: data.designation,
        email: data.email,
        seniority: data.seniority,
        isActive: true,
        dateJoined: new Date(data.dateJoined),
      },
    })

    const expertiseData: { staffId: string; expertiseArea: ExpertiseArea; isPrimary: boolean }[] = [
      { staffId: staff.id, expertiseArea: data.primaryExpertise, isPrimary: true },
    ]
    for (const area of data.additionalExpertise) {
      if (area !== data.primaryExpertise) {
        expertiseData.push({ staffId: staff.id, expertiseArea: area, isPrimary: false })
      }
    }
    await tx.staffExpertise.createMany({ data: expertiseData })

    await tx.auditLog.create({
      data: {
        eventType: AuditEventType.STAFF_CREATED,
        actorId,
        staffId: staff.id,
        payload: {
          employeeNumber: data.employeeNumber,
          fullName: data.fullName,
          seniority: data.seniority,
          expertiseAreas: expertiseData.map((e) => ({ area: e.expertiseArea, primary: e.isPrimary })),
        },
      },
    })

    return staff.id
  })

  return await getStaffProfile(result)
}

export async function listStaff(): Promise<StaffListItem[]> {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const staff = await prisma.staff.findMany({
    where: { deletedAt: null },
    orderBy: [{ seniority: 'asc' }, { fullName: 'asc' }],
    select: {
      id: true,
      employeeNumber: true,
      fullName: true,
      designation: true,
      seniority: true,
      isActive: true,
      dateJoined: true,
      expertiseAreas: {
        select: { expertiseArea: true, isPrimary: true },
        orderBy: { isPrimary: 'desc' },
      },
    },
  })

  // Read today's workload from the pre-aggregated snapshot instead of
  // re-summing raw allocation rows. The snapshot is kept in sync by the
  // allocation engine and manuallyAssignBrief() inside the same DB
  // transaction as every allocation write — it is always consistent.
  const staffIds = staff.map((s) => s.id)
  const workloadRecords = await prisma.dailyWorkload.findMany({
    where: { staffId: { in: staffIds }, workDate: today },
    select: { staffId: true, hoursAllocated: true, briefCount: true },
  })

  const workloadByStaff = new Map(workloadRecords.map((w) => [w.staffId, w]))

  return staff.map((s) => {
    const w = workloadByStaff.get(s.id)
    return {
      ...s,
      today: {
        hoursAllocated: w ? Number(w.hoursAllocated) : 0,
        briefCount: w?.briefCount ?? 0,
      },
    }
  })
}

export async function getStaffProfile(staffId: string): Promise<StaffProfile> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      employeeNumber: true,
      fullName: true,
      designation: true,
      email: true,
      seniority: true,
      isActive: true,
      dateJoined: true,
      createdAt: true,
      updatedAt: true,
      expertiseAreas: {
        select: { expertiseArea: true, isPrimary: true },
        orderBy: { isPrimary: 'desc' },
      },
    },
  })

  if (!staff || staff === null) {
    throw new Error(`StaffService: Staff not found — id=${staffId}`)
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [workload, allocations] = await Promise.all([
    prisma.dailyWorkload.findUnique({
      where: { staffId_workDate: { staffId, workDate: today } },
      select: { hoursAllocated: true, briefCount: true },
    }),
    prisma.allocation.findMany({
      where: { staffId },
      orderBy: { allocatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        briefId: true,
        allocationMethod: true,
        hoursAllocated: true,
        allocatedAt: true,
        isActive: true,
        brief: {
          select: { referenceNumber: true, subject: true },
        },
      },
    }),
  ])

  return {
    ...staff,
    expertiseAreas: staff.expertiseAreas,
    today: {
      hoursAllocated: workload ? Number(workload.hoursAllocated) : 0,
      briefCount: workload?.briefCount ?? 0,
    },
    allocations: allocations.map((a) => ({
      ...a,
      hoursAllocated: Number(a.hoursAllocated),
    })),
  }
}

export async function updateStaff(
  staffId: string,
  actorId: string,
  data: UpdateStaffInput,
): Promise<StaffProfile> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        deletedAt: true,
        isActive: true,
        fullName: true,
        designation: true,
        email: true,
        seniority: true,
        expertiseAreas: {
          select: { expertiseArea: true, isPrimary: true },
        },
      },
    })

    if (!existing || existing.deletedAt !== null) {
      throw new Error(`StaffService: Staff not found — id=${staffId}`)
    }

    const updateData: Prisma.StaffUpdateInput = {}
    let auditEvent: AuditEventType = AuditEventType.STAFF_UPDATED
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}

    if (data.fullName !== undefined) {
      before.fullName = existing.fullName
      updateData.fullName = data.fullName
      after.fullName = data.fullName
    }

    if (data.designation !== undefined) {
      before.designation = existing.designation
      updateData.designation = data.designation
      after.designation = data.designation
    }

    if (data.email !== undefined) {
      before.email = existing.email
      updateData.email = data.email
      after.email = data.email
    }

    if (data.seniority !== undefined) {
      before.seniority = existing.seniority
      updateData.seniority = data.seniority
      after.seniority = data.seniority
    }

    if (data.isActive !== undefined) {
      before.isActive = existing.isActive
      updateData.isActive = data.isActive
      after.isActive = data.isActive
      if (!data.isActive && existing.isActive) {
        auditEvent = AuditEventType.STAFF_DEACTIVATED
      }
    }

    let changed = Object.keys(updateData).length > 0

    if (data.expertiseAreas !== undefined) {
      changed = true
      before.expertiseAreas = existing.expertiseAreas.map((e) => ({
        area: e.expertiseArea,
        primary: e.isPrimary,
      }))
      after.expertiseAreas = data.expertiseAreas

      await tx.staffExpertise.deleteMany({
        where: { staffId },
      })

      const expertiseData: { expertiseArea: ExpertiseArea; isPrimary: boolean }[] = [
        { expertiseArea: data.expertiseAreas.primary, isPrimary: true },
      ]
      if (data.expertiseAreas.secondary) {
        for (const area of data.expertiseAreas.secondary) {
          if (area !== data.expertiseAreas.primary) {
            expertiseData.push({ expertiseArea: area, isPrimary: false })
          }
        }
      }
      await tx.staffExpertise.createMany({
        data: expertiseData.map((e) => ({
          staffId,
          expertiseArea: e.expertiseArea,
          isPrimary: e.isPrimary,
        })),
      })
    }

    if (changed) {
      if (Object.keys(updateData).length > 0) {
        await tx.staff.update({
          where: { id: staffId },
          data: updateData,
        })
      }

      await tx.auditLog.create({
        data: {
          eventType: auditEvent,
          actorId,
          staffId,
          payload: { before, after } as Prisma.InputJsonValue,
        },
      })
    }
  })

  return await getStaffProfile(staffId)
}

export async function getStaffWorkloadHistory(
  staffId: string,
  limit = 30,
): Promise<{ workDate: Date; hoursAllocated: number; briefCount: number }[]> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, deletedAt: true },
  })

  if (!staff || staff.deletedAt !== null) {
    throw new Error(`StaffService: Staff not found — id=${staffId}`)
  }

  const records = await prisma.dailyWorkload.findMany({
    where: { staffId },
    orderBy: { workDate: 'desc' },
    take: Math.min(limit, 365),
    select: { workDate: true, hoursAllocated: true, briefCount: true },
  })

  return records.map((r) => ({
    workDate: r.workDate,
    hoursAllocated: Number(r.hoursAllocated),
    briefCount: r.briefCount,
  }))
}

export async function removeStaff(staffId: string, actorId: string): Promise<void> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { id: true, deletedAt: true, userId: true, fullName: true },
  })

  if (!staff || staff.deletedAt !== null) {
    throw new Error(`StaffService: Staff not found — id=${staffId}`)
  }

  const activeAllocations = await prisma.allocation.findMany({
    where: {
      staffId,
      isActive: true,
      brief: {
        status: { in: [BriefStatus.ALLOCATED, BriefStatus.IN_PROGRESS] },
      },
    },
    select: {
      id: true,
      brief: {
        select: { referenceNumber: true, subject: true },
      },
    },
  })

  if (activeAllocations.length > 0) {
    throw new StaffConflictError(
      'Cannot remove staff with active brief allocations. Reassign or complete their active briefs first.',
      activeAllocations.map((a) => ({
        id: a.id,
        referenceNumber: a.brief.referenceNumber,
        subject: a.brief.subject,
      })),
    )
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date()

    if (staff.userId) {
      await tx.user.update({
        where: { id: staff.userId },
        data: { deletedAt: now },
      })
    }

    await tx.staff.update({
      where: { id: staffId },
      data: { deletedAt: now },
    })

    await tx.auditLog.create({
      data: {
        eventType: AuditEventType.STAFF_DEACTIVATED,
        actorId,
        staffId,
        payload: { fullName: staff.fullName, softDeleted: true },
      },
    })
  })
}
