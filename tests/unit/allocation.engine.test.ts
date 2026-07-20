import { AllocationEngine } from '@/domain/allocation/engine';
import { SeniorityLevel, AllocationMethod } from '@prisma/client';
import type { BriefInput, StaffCandidate } from '@/domain/allocation/types';

describe('AllocationEngine', () => {
  const engine = new AllocationEngine();

  // Helper to create a base candidate
  const createCandidate = (overrides: Partial<StaffCandidate>): StaffCandidate => ({
    id: 'staff-1',
    seniority: SeniorityLevel.SENIOR,
    isActive: true,
    expertiseAreas: [{ area: 'GENERAL_LEGAL_ADVISORY', isPrimary: true }],
    hoursToday: 0,
    briefCountToday: 0,
    ...overrides,
  });

  describe('Step 1: EMERGENCY', () => {
    it('allocates to the most senior available counsel with matching expertise', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'EMERGENCY',
        expertiseArea: 'GENERAL_LEGAL_ADVISORY',
        estimatedHours: 2,
        isRepeatMatter: false,
        priorStaffId: null,
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', seniority: SeniorityLevel.SENIOR }),
        createCandidate({ id: 's2', seniority: SeniorityLevel.DEPUTY_CHIEF }), // Should pick this one
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('ALLOCATED');
      if (result.outcome === 'ALLOCATED') {
        expect(result.staffId).toBe('s2');
        expect(result.method).toBe(AllocationMethod.AUTO_SENIORITY);
      }
    });

    it('falls back to the most senior counsel without expertise if specialists are busy/unavailable', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'EMERGENCY',
        expertiseArea: 'CABINET_MEMORANDA',
        estimatedHours: 2,
        isRepeatMatter: false,
        priorStaffId: null,
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', seniority: SeniorityLevel.SENIOR, expertiseAreas: [{ area: 'GENERAL_LEGAL_ADVISORY', isPrimary: true }] }),
        createCandidate({ id: 's2', seniority: SeniorityLevel.DEPUTY_CHIEF, expertiseAreas: [{ area: 'GENERAL_LEGAL_ADVISORY', isPrimary: true }] }), // Picks this despite no expertise
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('ALLOCATED');
      if (result.outcome === 'ALLOCATED') {
        expect(result.staffId).toBe('s2');
      }
    });

    it('returns QUEUED if all active counsel are at capacity', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'EMERGENCY',
        expertiseArea: 'CABINET_MEMORANDA',
        estimatedHours: 2,
        isRepeatMatter: false,
        priorStaffId: null,
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', hoursToday: 8 }), // DAILY_CAPACITY_HOURS is 8.0, so adding 2 exceeds it
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('QUEUED');
    });
  });

  describe('Step 2: REPEAT_MATTER', () => {
    it('routes back to prior counsel if they have capacity', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'ROUTINE',
        expertiseArea: 'GENERAL_LEGAL_ADVISORY',
        estimatedHours: 2,
        isRepeatMatter: true,
        priorStaffId: 's1', // Repeat matter targets s1
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', hoursToday: 2 }),
        createCandidate({ id: 's2', hoursToday: 0 }), // s2 is less loaded, but s1 should get it
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('ALLOCATED');
      if (result.outcome === 'ALLOCATED') {
        expect(result.staffId).toBe('s1');
        expect(result.method).toBe(AllocationMethod.AUTO_REPEAT_MATTER);
      }
    });

    it('returns REPEAT_MATTER_FALLBACK if prior counsel is at capacity', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'ROUTINE',
        expertiseArea: 'GENERAL_LEGAL_ADVISORY',
        estimatedHours: 4,
        isRepeatMatter: true,
        priorStaffId: 's1',
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', hoursToday: 6 }), // 6 + 4 = 10 > 8
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('REPEAT_MATTER_FALLBACK');
      if (result.outcome === 'REPEAT_MATTER_FALLBACK') {
        expect(result.priorStaffId).toBe('s1');
      }
    });
  });

  describe('Step 3: URGENT', () => {
    it('allocates to the most senior available counsel with matching expertise', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'URGENT',
        expertiseArea: 'GENERAL_LEGAL_ADVISORY',
        estimatedHours: 2,
        isRepeatMatter: false,
        priorStaffId: null,
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', seniority: SeniorityLevel.SENIOR }),
        createCandidate({ id: 's2', seniority: SeniorityLevel.PRINCIPAL }), // Should pick s2 based on seniority
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('ALLOCATED');
      if (result.outcome === 'ALLOCATED') {
        expect(result.staffId).toBe('s2');
        expect(result.method).toBe(AllocationMethod.AUTO_SENIORITY);
      }
    });
  });

  describe('Step 4: ROUTINE', () => {
    it('allocates to the least loaded counsel with matching expertise', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'ROUTINE',
        expertiseArea: 'GENERAL_LEGAL_ADVISORY',
        estimatedHours: 2,
        isRepeatMatter: false,
        priorStaffId: null,
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', hoursToday: 4 }),
        createCandidate({ id: 's2', hoursToday: 2 }), // s2 is less loaded
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('ALLOCATED');
      if (result.outcome === 'ALLOCATED') {
        expect(result.staffId).toBe('s2');
        expect(result.method).toBe(AllocationMethod.AUTO_EXPERTISE);
      }
    });
  });

  describe('Step 5: QUEUE Fallback', () => {
    it('queues a ROUTINE brief if no counsel with expertise has capacity', () => {
      const brief: BriefInput = {
        id: 'b1',
        urgency: 'ROUTINE',
        expertiseArea: 'CABINET_MEMORANDA',
        estimatedHours: 2,
        isRepeatMatter: false,
        priorStaffId: null,
      };

      const candidates: StaffCandidate[] = [
        createCandidate({ id: 's1', hoursToday: 0 }), // Has capacity but no expertise
      ];

      const result = engine.allocate(brief, candidates);
      expect(result.outcome).toBe('QUEUED');
    });
  });
});
