import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import i18n from '../i18n'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import { resetLocalStorageMock } from './mocks/localStorage'
import { pocketbaseCollectionApi, resetPocketbaseMocks } from './mocks/pocketbase'

// Distinct from the mock's hardcoded `created` default (2024-01-01) so a test can't
// pass by accident if the mapping reads the collection's own `created` field instead
// of `created_at`.
const IMPORTED_CREATED_AT = '2020-05-15T10:30:00.000Z'
const OTHER_IMPORTED_CREATED_AT = '2019-03-02T08:00:00.000Z'

function createUser(id: string): RecordModel {
  return {
    id,
    collectionId: 'users',
    collectionName: 'users',
    name: `User ${id}`,
    email: `${id}@example.com`,
  }
}

describe('Favorite Import', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('shows an alert when importing invalid JSON through the new import path', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })

    const importPromise = favoritesStore.importFromFile(
      new File(['not valid json'], 'favorites.json', {
        type: 'application/json',
      }),
    )

    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(favoritesUiStore.alertDialog.visible).toBe(true)
    expect(favoritesUiStore.alertDialog.message).toContain('Error during import')

    favoritesUiStore.closeAlert()
    await importPromise
  })

  it('skips imported favorites with unsafe URL schemes', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'malicious',
        url: 'javascript:alert("xss")',
        title: 'Bad Favorite',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()

    expect(favoritesStore.favorites).toEqual([])
    expect(favoritesUiStore.alertDialog.visible).toBe(true)
    expect(favoritesUiStore.alertDialog.message).toContain('0 added')

    favoritesUiStore.closeAlert()
    await importPromise
  })

  it('preserves the original creation date when importing in cloud mode (AE1)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-1',
        url: 'https://youtube.com/watch?v=cloudimport1',
        title: 'Imported Favorite',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
        created: IMPORTED_CREATED_AT,
      },
    ])

    await flushPromises()

    expect(favoritesStore.favorites[0]?.created).toBe(IMPORTED_CREATED_AT)

    favoritesUiStore.closeAlert()
    await importPromise
  })

  it('defaults to the import time when the imported entry has no creation date in cloud mode (AE2)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    const before = Date.now()
    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-2',
        url: 'https://youtube.com/watch?v=cloudimport2',
        title: 'Imported Favorite Without Date',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    const after = Date.now()

    const createdTime = new Date(favoritesStore.favorites[0]?.created ?? '').getTime()
    expect(createdTime).toBeGreaterThanOrEqual(before)
    expect(createdTime).toBeLessThanOrEqual(after)

    favoritesUiStore.closeAlert()
    await importPromise
  })

  it('sorts imported cloud favorites by their preserved dates, not import order (AE3)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-newer',
        url: 'https://youtube.com/watch?v=importNew1B',
        title: 'Newer Import',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
        created: IMPORTED_CREATED_AT,
      },
      {
        id: 'import-older',
        url: 'https://youtube.com/watch?v=importOld1A',
        title: 'Older Import',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
        created: OTHER_IMPORTED_CREATED_AT,
      },
    ])

    await flushPromises()

    favoritesUiStore.closeAlert()
    await importPromise

    expect(favoritesUiStore.filteredFavorites.map((favorite) => favorite.url)).toEqual([
      'https://www.youtube.com/watch?v=importNew1B',
      'https://www.youtube.com/watch?v=importOld1A',
    ])
  })

  it('retries a create rejected by the server rate limiter instead of counting it as a duplicate', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    pocketbaseCollectionApi.create.mockRejectedValueOnce({ status: 429, response: {} })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-rate-limited',
        url: 'https://youtube.com/watch?v=rateLimited1',
        title: 'Rate Limited Favorite',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    // Comfortably longer than the production backoff (1s) to absorb CI scheduling jitter.
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    expect(favoritesStore.favorites).toHaveLength(1)
    expect(favoritesUiStore.alertDialog.message).toContain('1 added')
    expect(favoritesUiStore.alertDialog.message).not.toContain('already present')
  }, 10000)

  it('reports a non-recoverable create failure as failed, never as an already-present duplicate', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    pocketbaseCollectionApi.create.mockRejectedValue({ status: 400, response: {} })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-failing',
        url: 'https://youtube.com/watch?v=alwaysFails1',
        title: 'Failing Favorite',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    expect(favoritesStore.favorites).toHaveLength(0)
    expect(favoritesUiStore.alertDialog.message).not.toContain('already present')
    expect(favoritesUiStore.alertDialog.message).toMatch(/failed/i)
  })

  it('reports import progress while running and clears it when the import finishes', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    let resolveFirstCreate: (() => void) | undefined
    pocketbaseCollectionApi.create.mockImplementationOnce(
      (data) =>
        new Promise((resolve) => {
          resolveFirstCreate = () =>
            resolve({
              id: 'mock-progress',
              created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
              ...data,
            })
        }),
    )

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-progress-1',
        url: 'https://youtube.com/watch?v=progress1',
        title: 'Progress Favorite 1',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
      {
        id: 'import-progress-2',
        url: 'https://youtube.com/watch?v=progress2',
        title: 'Progress Favorite 2',
        artists: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()

    expect(favoritesStore.importProgress).toEqual({ processed: 0, total: 2 })

    resolveFirstCreate?.()
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    expect(favoritesStore.importProgress).toBeNull()
  })
})
