import { vi } from 'vitest'

// Mock Pocketbase module
export const mockPocketbase = {
  collection: vi.fn(() => ({
    getFullList: vi.fn(() => Promise.resolve([])),
    create: vi.fn((data) => Promise.resolve({ id: 'mock-id', ...data })),
    update: vi.fn((id, data) => Promise.resolve({ id, ...data })),
    delete: vi.fn(() => Promise.resolve()),
  })),
  health: {
    check: vi.fn(() => Promise.resolve({ code: 200 })),
  },
  autoCancellation: vi.fn(),
}

// Mock the pocketbase module
vi.mock('pocketbase', () => ({
  default: vi.fn(() => mockPocketbase),
}))

export const resetPocketbaseMocks = () => {
  mockPocketbase.collection.mockClear()
  mockPocketbase.health.check.mockClear()
  mockPocketbase.autoCancellation.mockClear()
}
