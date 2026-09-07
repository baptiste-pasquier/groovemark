import { vi, type Mock } from 'vitest'

function createCollectionApi() {
  return {
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
    getFirstListItem: vi.fn(() => Promise.reject({ status: 404 })),
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
}

type CollectionApi = ReturnType<typeof createCollectionApi>

// Loose shape used only to type `mockPocketbase.collection`'s implementation.
// Several specs predate this per-collection routing and built their own
// local, narrower collection double (missing `getFirstListItem`, or with a
// bare `vi.fn()` for methods they never drive) before overriding
// `mockPocketbase.collection.mockImplementation(...)` in their own
// `beforeEach`. Typing the shared mock's return value this loosely -- rather
// than as the fully-specific `CollectionApi` -- keeps those overrides
// type-checking unchanged while still giving the default (non-overridden)
// implementation real, distinct collection doubles.
interface MockCollectionHandle {
  getFullList: Mock
  create: Mock
  update: Mock
  delete: Mock
  getFirstListItem?: Mock
  authWithOAuth2: Mock
}

function resetCollectionApi(api: CollectionApi) {
  api.getFullList.mockReset()
  api.getFullList.mockResolvedValue([])
  api.create.mockReset()
  api.create.mockImplementation((data) =>
    Promise.resolve({
      id: 'mock-id',
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      ...data,
    }),
  )
  api.update.mockReset()
  api.update.mockImplementation((id, data) =>
    Promise.resolve({
      id,
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      ...data,
    }),
  )
  api.delete.mockReset()
  api.delete.mockResolvedValue(undefined)
  api.getFirstListItem.mockReset()
  api.getFirstListItem.mockRejectedValue({ status: 404 })
  api.authWithOAuth2.mockReset()
  api.authWithOAuth2.mockImplementation(async () => {
    const record = {
      id: 'google-user',
      name: 'Google User',
      email: 'google@example.com',
    }
    mockPocketbase.authStore.isValid = true
    mockPocketbase.authStore.model = record
    return { record }
  })
}

const favoritesCollectionApi = createCollectionApi()
const artistsCollectionApi = createCollectionApi()

export const mockPocketbase = {
  collection: vi.fn(
    (name?: string): MockCollectionHandle =>
      name === 'artists' ? artistsCollectionApi : favoritesCollectionApi,
  ),
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
  default: vi.fn(function MockPocketBase() {
    return mockPocketbase
  }),
}))

export function resetPocketbaseMocks() {
  resetCollectionApi(favoritesCollectionApi)
  resetCollectionApi(artistsCollectionApi)
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

export const pocketbaseCollectionApi = favoritesCollectionApi
export const pocketbaseArtistsCollectionApi = artistsCollectionApi
