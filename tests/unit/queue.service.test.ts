import { manuallyAssignBrief, withdrawBrief } from '@/server/services/queue.service';
import { prisma } from '@/server/db';
import { BriefStatus } from '@prisma/client';

// The mocked prisma instance
const prismaMock = prisma as jest.Mocked<typeof prisma>;

describe('QueueService', () => {
  beforeEach(() => {
    // Mock the $transaction to just execute the callback with the prisma mock
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      return await callback(prismaMock);
    });
  });

  describe('manuallyAssignBrief', () => {
    it('throws if brief is not found', async () => {
      prismaMock.brief.findUnique.mockResolvedValueOnce(null);

      await expect(
        manuallyAssignBrief('b1', 's1', 'actor1')
      ).rejects.toThrow('QueueService: Brief not found');
    });

    it('throws if brief is not in QUEUED status', async () => {
      prismaMock.brief.findUnique.mockResolvedValueOnce({ id: 'b1', status: BriefStatus.RECEIVED } as any);

      await expect(
        manuallyAssignBrief('b1', 's1', 'actor1')
      ).rejects.toThrow('QueueService: Brief is not in QUEUED status');
    });

    it('assigns brief successfully when valid', async () => {
      // 1. Brief found and queued
      prismaMock.brief.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BriefStatus.QUEUED,
        estimatedHours: 2,
      } as any);

      // Queue item found and unresolved
      prismaMock.allocationQueue.findUnique.mockResolvedValueOnce({
        id: 'q1',
        resolvedAt: null,
      } as any);

      // 2. Staff found and active
      prismaMock.staff.findUnique.mockResolvedValueOnce({
        id: 's1',
        isActive: true,
        deletedAt: null,
      } as any);

      // 3. Create allocation
      prismaMock.allocation.create.mockResolvedValueOnce({ id: 'alloc1' } as any);

      const result = await manuallyAssignBrief('b1', 's1', 'actor1', 'notes');

      expect(result.success).toBe(true);
      expect(result.allocationId).toBe('alloc1');

      // Verify updates
      expect(prismaMock.brief.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: BriefStatus.ALLOCATED },
      });
      expect(prismaMock.allocationQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { briefId: 'b1' } })
      );
      expect(prismaMock.dailyWorkload.upsert).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('withdrawBrief', () => {
    it('withdraws brief successfully when valid', async () => {
      prismaMock.brief.findUnique.mockResolvedValueOnce({
        id: 'b1',
        status: BriefStatus.QUEUED,
      } as any);

      prismaMock.allocationQueue.findUnique.mockResolvedValueOnce({
        id: 'q1',
        resolvedAt: null,
      } as any);

      const result = await withdrawBrief('b1', 'actor1');
      expect(result.success).toBe(true);

      // Verify updates
      expect(prismaMock.brief.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: { status: BriefStatus.CLOSED },
      });
      expect(prismaMock.allocationQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { briefId: 'b1' } })
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });
});
