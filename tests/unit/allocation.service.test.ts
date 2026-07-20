import { runAllocation } from '@/server/services/allocation.service';
import { prisma } from '@/server/db';
import { BriefStatus, AllocationMethod } from '@prisma/client';

const prismaMock = prisma as jest.Mocked<typeof prisma>;

describe('AllocationService', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return await callback(prismaMock);
    });
  });

  it('throws error if brief not found', async () => {
    prismaMock.brief.findUnique.mockResolvedValueOnce(null);
    await expect(runAllocation('b1', 'actor1')).rejects.toThrow('AllocationService: brief not found');
  });

  it('allocates successfully and writes to db', async () => {
    // 1. Brief
    prismaMock.brief.findUnique.mockResolvedValueOnce({
      id: 'b1',
      urgency: 'ROUTINE',
      expertiseArea: 'GENERAL_LEGAL_ADVISORY',
      estimatedHours: 2,
      isRepeatMatter: false,
      parentBriefId: null,
      status: BriefStatus.RECEIVED,
      referenceNumber: 'REF-1',
      subject: 'Subject',
    } as any);

    // 2. Staff
    prismaMock.staff.findMany.mockResolvedValueOnce([
      {
        id: 's1',
        seniority: 'SENIOR',
        isActive: true,
        expertiseAreas: [{ expertiseArea: 'GENERAL_LEGAL_ADVISORY', isPrimary: true }],
      }
    ] as any);

    // 3. Workload
    prismaMock.dailyWorkload.findMany.mockResolvedValueOnce([
      { staffId: 's1', hoursAllocated: 2, briefCount: 1 }
    ] as any);

    // 4. Create Mock
    prismaMock.allocation.create.mockResolvedValueOnce({ id: 'alloc1' } as any);

    const result = await runAllocation('b1', 'actor1');
    expect(result.outcome).toBe('ALLOCATED');

    if (result.outcome === 'ALLOCATED') {
      expect(result.staffId).toBe('s1');
      expect(prismaMock.brief.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: BriefStatus.ALLOCATED },
      });
      expect(prismaMock.allocation.create).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    }
  });
});
