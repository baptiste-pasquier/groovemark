import { vi } from 'vitest'

const collectionApi = {
  getFullList: vi.fn(() => Promise.resolve([])),
  create: vi.fn((data) =>
    Promise.resolve({
      id: 'mock-id',
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      ...data,
    }),
  ),
  update: vi.fn((id, data) =>
    Promise.resolve({
      id,
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      ...data,
    }),
  ),
  delete: vi.fn(() => Promise.resolve()),
  authWithOAuth2: vi.fn(async () => {
    const record = {
      id: 'google-user',
      name: 'Google User',
      email: 'google@example.com',
    }
    mockPocketbase.authStore.isValid = true
    mockPocketbase.authStore.model = record
    return { record }
  }),
}

export const mockPocketbase = {
  collection: vi.fn(() => collectionApi),
  health: {
    check: vi.fn(() => Promise.resolve({ code: 200 })),
  },
  authStore: {
    isValid: false,
    model: null as Record<string, unknown> | null,
    clear: vi.fn(() => {
      mockPocketbase.authStore.isValid = false
      mockPocketbase.authStore.model = null
    }),
  },
  autoCancellation: vi.fn(),
  send: vi.fn(() => Promise.resolve({ long_url: 'https://soundcloud.com/test/track' })),
}

vi.mock('pocketbase', () => ({
  default: vi.fn(() => mockPocketbase),
}))

export function resetPocketbaseMocks() {
  collectionApi.getFullList.mockReset()
  collectionApi.getFullList.mockResolvedValue([])
  collectionApi.create.mockReset()
  collectionApi.create.mockImplementation((data) =>
    Promise.resolve({
      id: 'mock-id',
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      ...data,
    }),
  )
  collectionApi.update.mockReset()
  collectionApi.update.mockImplementation((id, data) =>
    Promise.resolve({
      id,
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      ...data,
    }),
  )
  collectionApi.delete.mockReset()
  collectionApi.delete.mockResolvedValue(undefined)
  collectionApi.authWithOAuth2.mockReset()
  collectionApi.authWithOAuth2.mockImplementation(async () => {
    const record = {
      id: 'google-user',
      name: 'Google User',
      email: 'google@example.com',
    }
    mockPocketbase.authStore.isValid = true
    mockPocketbase.authStore.model = record
    return { record }
  })
  mockPocketbase.collection.mockClear()
  mockPocketbase.health.check.mockReset()
  mockPocketbase.health.check.mockResolvedValue({ code: 200 })
  mockPocketbase.authStore.isValid = false
  mockPocketbase.authStore.model = null
  mockPocketbase.authStore.clear.mockClear()
  mockPocketbase.autoCancellation.mockClear()
  mockPocketbase.send.mockReset()
  mockPocketbase.send.mockResolvedValue({ long_url: 'https://soundcloud.com/test/track' })
}

export const pocketbaseCollectionApi = collectionApi
