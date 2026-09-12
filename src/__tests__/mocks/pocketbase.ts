import { vi, type Mock } from 'vitest'

function createCollectionApi() {
  return {
    // Annotated rather than inferred: an inferred `Promise<never[]>` makes
    // every `getFullList.mockResolvedValue([record])` in a spec need an
    // `as never`, which the code style keeps for DOM and storage casts only.
    getFullList: vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([])),
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

// One batch request as the double recorded it: the SDK's batch builder returns
// nothing from create/update/delete, so a spec can only see what a save sent by
// reading this log.
export interface MockBatchRequest {
  method: 'create' | 'update' | 'delete'
  collection: string
  id?: string
  data?: Record<string, unknown>
}

// A single batch handle whose request log is emptied by each `createBatch()`
// call, so a spec reads exactly the requests of the save it just drove instead
// of every save in the file. `requests` is mutated in place, never reassigned,
// so the exported reference stays live.
function createBatchApi() {
  const requests: MockBatchRequest[] = []

  const collection = vi.fn((name: string) => ({
    create: vi.fn((data: Record<string, unknown>) => {
      requests.push({
        method: 'create',
        collection: name,
        id: typeof data?.id === 'string' ? data.id : undefined,
        data,
      })
    }),
    update: vi.fn((id: string, data: Record<string, unknown>) => {
      requests.push({ method: 'update', collection: name, id, data })
    }),
    delete: vi.fn((id: string) => {
      requests.push({ method: 'delete', collection: name, id })
    }),
  }))

  const send = vi.fn(() =>
    Promise.resolve(requests.map((request) => ({ status: 200, body: { id: request.id } }))),
  )

  return { requests, collection, send }
}

type BatchApi = ReturnType<typeof createBatchApi>

function resetBatchApi(api: BatchApi) {
  api.requests.length = 0
  api.collection.mockClear()
  api.send.mockReset()
  api.send.mockImplementation(() =>
    Promise.resolve(api.requests.map((request) => ({ status: 200, body: { id: request.id } }))),
  )
}

const favoritesCollectionApi = createCollectionApi()
const artistsCollectionApi = createCollectionApi()
const eventsCollectionApi = createCollectionApi()
const performancesCollectionApi = createCollectionApi()
const batchApi = createBatchApi()

// Every collection with its own double. A name absent from this map falls
// through to favorites, which is why `mocks/pocketbase.spec.ts` asserts that
// each routed collection gets a distinct handle: an unrouted collection would
// otherwise share the favorites double and its queued responses.
const collectionApis: Record<string, CollectionApi> = {
  favorites: favoritesCollectionApi,
  artists: artistsCollectionApi,
  events: eventsCollectionApi,
  performances: performancesCollectionApi,
}

export const mockPocketbase = {
  collection: vi.fn(
    (name?: string): MockCollectionHandle =>
      (name && collectionApis[name]) || favoritesCollectionApi,
  ),
  createBatch: vi.fn(() => {
    batchApi.requests.length = 0
    return batchApi
  }),
  // Real PocketBase interpolates {:param} placeholders; tests never assert on
  // the resulting string, so a simple pass-through is enough to let
  // `findBySlug`'s `pb.filter(...)` call succeed instead of throwing.
  filter: vi.fn((expression: string) => expression),
  // The avatar is a plain unprotected file field, so the real SDK just
  // assembles an address. The double returns a recognisable one rather than a
  // realistic one: specs assert that an address was produced from the record's
  // own filename, never what a PocketBase deployment would serve.
  files: {
    getURL: vi.fn(
      (record: { id?: string }, filename: string, options?: { thumb?: string }) =>
        `https://pb.test/api/files/users/${record?.id}/${filename}${
          options?.thumb ? `?thumb=${options.thumb}` : ''
        }`,
    ),
  },
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
  resetCollectionApi(eventsCollectionApi)
  resetCollectionApi(performancesCollectionApi)
  resetBatchApi(batchApi)
  mockPocketbase.collection.mockClear()
  mockPocketbase.createBatch.mockClear()
  mockPocketbase.files.getURL.mockClear()
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
export const pocketbaseEventsCollectionApi = eventsCollectionApi
export const pocketbasePerformancesCollectionApi = performancesCollectionApi
export const pocketbaseBatchApi = batchApi
