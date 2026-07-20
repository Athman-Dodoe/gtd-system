import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

// Set up Prisma Client mocking globally
jest.mock('@/server/db', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Also reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
