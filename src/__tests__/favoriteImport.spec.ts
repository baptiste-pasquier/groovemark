import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import i18n from '../i18n'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import {
  buildBackupExportPayload,
  buildFavoritesExportPayload,
  buildImportArtistPopulation,
  useFavoritesStore,
} from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import { BACKUP_FORMAT_VERSION } from '../services/favoriteImport'
import { localStorageMock, resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'
import {
  pocketbaseArtistsCollectionApi,
  pocketbaseCollectionApi,
  resetPocketbaseMocks,
} from './mocks/pocketbase'
import type { MusicEvent } from '../types/event'
import type { Favorite } from '../types/favorite'

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
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

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
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'malicious',
        url: 'javascript:alert("xss")',
        title: 'Bad Favorite',
        artists: [],
        artistIds: [],
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
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-1',
        url: 'https://youtube.com/watch?v=cloudimport1',
        title: 'Imported Favorite',
        artists: [],
        artistIds: [],
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
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    const before = Date.now()
    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-2',
        url: 'https://youtube.com/watch?v=cloudimport2',
        title: 'Imported Favorite Without Date',
        artists: [],
        artistIds: [],
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
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-newer',
        url: 'https://youtube.com/watch?v=importNew1B',
        title: 'Newer Import',
        artists: [],
        artistIds: [],
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
        artistIds: [],
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
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    pocketbaseCollectionApi.create.mockRejectedValueOnce({ status: 429, response: {} })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-rate-limited',
        url: 'https://youtube.com/watch?v=rateLimited1',
        title: 'Rate Limited Favorite',
        artists: [],
        artistIds: [],
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
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    pocketbaseCollectionApi.create.mockRejectedValue({ status: 400, response: {} })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-failing',
        url: 'https://youtube.com/watch?v=alwaysFails1',
        title: 'Failing Favorite',
        artists: [],
        artistIds: [],
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
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

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
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
      {
        id: 'import-progress-2',
        url: 'https://youtube.com/watch?v=progress2',
        title: 'Progress Favorite 2',
        artists: [],
        artistIds: [],
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

  it('goes back to full speed immediately after a rate-limited item recovers', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    const callTimes: number[] = []
    pocketbaseCollectionApi.create.mockImplementation((data) => {
      callTimes.push(Date.now())
      // Only the very first call (item 1's first attempt) is rate-limited;
      // every retry and every later item succeeds straight away.
      if (callTimes.length === 1) {
        return Promise.reject({ status: 429, response: {} })
      }
      return Promise.resolve({
        id: `mock-${callTimes.length}`,
        created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
        ...data,
      })
    })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'import-speed-1',
        url: 'https://youtube.com/watch?v=speed1',
        title: 'Speed Favorite 1',
        artists: [],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
      {
        id: 'import-speed-2',
        url: 'https://youtube.com/watch?v=speed2',
        title: 'Speed Favorite 2',
        artists: [],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    // item 1: attempt 1 (429) then attempt 2 (retry, succeeds) -> calls 1 and 2.
    // item 2 should follow immediately once the limiter has reset, not after
    // another ~1s wait for a delay it already believes it cleared.
    expect(callTimes).toHaveLength(3)
    expect(callTimes[2] - callTimes[1]).toBeLessThan(200)
  }, 10000)

  it('marks the import busy before the file is parsed, closing the window for a second concurrent import', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    let resolveFileText: ((text: string) => void) | undefined
    const slowFile = {
      text: () =>
        new Promise<string>((resolve) => {
          resolveFileText = resolve
        }),
    } as unknown as File

    expect(favoritesStore.importProgress).toBeNull()

    const importPromise = favoritesStore.importFromFile(slowFile)
    await flushPromises()

    // The file hasn't finished reading yet, but the control must already be busy.
    expect(favoritesStore.importProgress).not.toBeNull()

    resolveFileText?.('[]')
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    expect(favoritesStore.importProgress).toBeNull()
  })

  it('imports a pre-identity export with no artistIds field with no artist-field error (AE6)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const legacyEntry = {
      id: 'legacy-1',
      url: 'https://youtube.com/watch?v=legacyExport1',
      title: 'Legacy Export Favorite',
      artists: ['Some Artist'],
      type: 'youtube',
      thumbnail: '',
      timestamps: [],
    } as unknown as Favorite

    const importPromise = favoritesStore.importFavorites([legacyEntry])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.failed).toBe(0)
    expect(result.added).toBe(1)
    expect(favoritesStore.favorites[0]?.artistIds).toHaveLength(1)
    expect(artistsStore.artists).toHaveLength(1)
    expect(artistsStore.artists[0]?.displayName).toBe('Some Artist')
  })

  it('collapses two spellings of the same artist across rows into one artist (AE9)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'spelling-1',
        url: 'https://youtube.com/watch?v=spelling1',
        title: 'Spelling One',
        artists: ['Amelie Lens'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
      {
        id: 'spelling-2',
        url: 'https://youtube.com/watch?v=spelling2',
        title: 'Spelling Two',
        artists: ['amelie lens'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.added).toBe(2)
    expect(artistsStore.artists).toHaveLength(1)

    const [first, second] = favoritesStore.favorites
    expect(first?.artistIds).toHaveLength(1)
    expect(second?.artistIds).toHaveLength(1)
    expect(first?.artistIds[0]).toBe(second?.artistIds[0])
  })

  it('creates several new local-mode artists in one storage write instead of one per artist', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const artistsWriteCallsBeforeImport = localStorageMock.setItem.mock.calls.filter(
      ([key]) => key === 'groovemark:artists:local',
    ).length

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'batch-1',
        url: 'https://youtube.com/watch?v=batch1',
        title: 'Batch One',
        artists: ['Artist One'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
      {
        id: 'batch-2',
        url: 'https://youtube.com/watch?v=batch2',
        title: 'Batch Two',
        artists: ['Artist Two'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
      {
        id: 'batch-3',
        url: 'https://youtube.com/watch?v=batch3',
        title: 'Batch Three',
        artists: ['Artist Three'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.added).toBe(3)
    expect(artistsStore.artists).toHaveLength(3)

    const artistsWriteCallsDuringImport =
      localStorageMock.setItem.mock.calls.filter(([key]) => key === 'groovemark:artists:local')
        .length - artistsWriteCallsBeforeImport
    expect(artistsWriteCallsDuringImport).toBe(1)
  })

  it('credits an existing artist and leaves its display name unchanged (AE17)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    artistsStore.artists.push({
      id: 'existing-artist-1',
      displayName: 'Amelie Lens',
      slug: 'amelie lens',
    })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'existing-artist-import',
        url: 'https://youtube.com/watch?v=existingArtist1',
        title: 'Existing Artist Favorite',
        artists: ['amelie lens'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.added).toBe(1)
    expect(artistsStore.artists).toHaveLength(1)
    expect(artistsStore.artists[0]?.displayName).toBe('Amelie Lens')
    expect(favoritesStore.favorites[0]?.artistIds).toEqual(['existing-artist-1'])
  })

  it('creates no artists when every row is skipped as an already-present duplicate URL', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const addResult = await favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=alreadyThere1',
      title: 'Already There',
      artists: [],
      timestamps: [],
      thumbnail: '',
    })
    expect(addResult).toBe(true)

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'duplicate-url-import',
        url: 'https://youtube.com/watch?v=alreadyThere1',
        title: 'Duplicate Favorite',
        artists: ['Should Not Be Created'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.skipped).toBe(1)
    expect(result.added).toBe(0)
    expect(artistsStore.artists).toEqual([])
  })

  it('retries an artist create rejected by the rate limit instead of failing the favorite', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    pocketbaseArtistsCollectionApi.create.mockRejectedValueOnce({ status: 429, response: {} })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'artist-rate-limited',
        url: 'https://youtube.com/watch?v=artistRateLimited1',
        title: 'Rate Limited Artist Favorite',
        artists: ['New Artist'],
        artistIds: [],
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
    const result = await importPromise

    expect(result.failed).toBe(0)
    expect(result.added).toBe(1)
    expect(artistsStore.artists).toHaveLength(1)
    expect(favoritesStore.favorites[0]?.artistIds).toEqual([artistsStore.artists[0]?.id])
  }, 10000)

  it('leaves the favorite unimported rather than under-crediting it when an artist create fails outright', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    // "Real Artist" already exists, so it resolves without any create call --
    // isolating the failure to the genuinely new artist name.
    artistsStore.artists.push({
      id: 'real-artist-1',
      displayName: 'Real Artist',
      slug: 'real artist',
    })

    pocketbaseArtistsCollectionApi.create.mockRejectedValue({ status: 400, response: {} })
    pocketbaseArtistsCollectionApi.getFirstListItem.mockRejectedValue({ status: 404 })

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'artist-create-fails',
        url: 'https://youtube.com/watch?v=artistCreateFails1',
        title: 'Failing Artist Favorite',
        artists: ['Real Artist', 'New Artist That Fails'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.added).toBe(0)
    expect(result.failed).toBe(1)
    expect(
      favoritesStore.favorites.some(
        (favorite) => favorite.url === 'https://www.youtube.com/watch?v=artistCreateFails1',
      ),
    ).toBe(false)
  })

  it('reuses the artist found by the fallback lookup when a create is rejected by the unique index (KTD7)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    pocketbaseArtistsCollectionApi.create.mockRejectedValue({ status: 400, response: {} })
    pocketbaseArtistsCollectionApi.getFirstListItem.mockResolvedValue({
      id: 'winner-1',
      displayName: 'New Artist',
      slug: 'new artist',
    } as never)

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'artist-create-races',
        url: 'https://youtube.com/watch?v=artistCreateRaces1',
        title: 'Raced Artist Favorite',
        artists: ['New Artist'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.added).toBe(1)
    expect(result.failed).toBe(0)
    expect(artistsStore.artists).toHaveLength(1)
    expect(artistsStore.artists[0]?.id).toBe('winner-1')
    expect(favoritesStore.favorites[0]?.artistIds).toEqual(['winner-1'])
  })

  it('drops an empty-once-trimmed artist name silently rather than failing the favorite (R18/AE8)', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const importPromise = favoritesStore.importFavorites([
      {
        id: 'blank-artist-name',
        url: 'https://youtube.com/watch?v=blankArtistName1',
        title: 'Blank Artist Name Favorite',
        artists: ['   ', 'Real Artist'],
        artistIds: [],
        type: 'youtube',
        thumbnail: '',
        timestamps: [],
      },
    ])

    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result.added).toBe(1)
    expect(result.failed).toBe(0)
    expect(favoritesStore.favorites[0]?.artistIds).toHaveLength(1)
  })

  it('exports artist names as strings, not identities', () => {
    const favorite: Favorite = {
      id: 'export-1',
      url: 'https://youtube.com/watch?v=export1',
      title: 'Export Favorite',
      artists: ['Amelie Lens'],
      artistIds: ['artist-1'],
      type: 'youtube',
      thumbnail: 'https://img.test/thumbnail.jpg',
      timestamps: [],
      created: '2024-01-01T00:00:00.000Z',
    }

    const result = buildFavoritesExportPayload([favorite])

    expect(result).toHaveLength(1)
    expect(result[0]).not.toHaveProperty('artistIds')
    expect(result[0]?.artists).toEqual(['Amelie Lens'])
  })
})

// ---- The single backup file (R22, R23, R24) --------------------------------

describe('Backup file format', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  function backupFile(content: unknown): File {
    return new File(
      [typeof content === 'string' ? content : JSON.stringify(content)],
      'backup.json',
      {
        type: 'application/json',
      },
    )
  }

  async function localSession() {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    await favoritesStore.initializeForCurrentSession(init)

    return { artistsStore, eventsStore, favoritesStore, favoritesUiStore: useFavoritesUiStore() }
  }

  function exportedMix(id: string, url: string, artists: string[]): Favorite {
    return {
      id,
      url,
      title: `Mix ${id}`,
      artists,
      artistIds: ['ignored-identity'],
      type: 'youtube',
      thumbnail: 'https://img.test/thumbnail.jpg',
      timestamps: [],
      created: '2024-01-01T00:00:00.000Z',
    }
  }

  function exportedEvent(
    id: string,
    name: string,
    performances: MusicEvent['performances'],
  ): MusicEvent {
    return {
      id,
      name,
      dateAttended: '2026-05-04',
      venue: `${name} venue`,
      performances,
    }
  }

  function storedPerformance(
    id: string,
    eventId: string,
    artistId: string,
    artistName: string,
    verdict: MusicEvent['performances'][number]['verdict'] = null,
  ) {
    return { id, eventId, artistId, artistName, verdict }
  }

  it('writes one envelope carrying an integer version, the mixes and the events (R22, R24)', () => {
    const payload = buildBackupExportPayload(
      [exportedMix('mix-1', 'https://youtube.com/watch?v=envelope1', ['Amelie Lens'])],
      [
        exportedEvent('event-1', 'Nuits Sonores', [
          storedPerformance('perf-1', 'event-1', 'artist-1', 'Daft Punk', 'three-stars'),
        ]),
      ],
    )

    expect(payload.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(Number.isInteger(payload.formatVersion)).toBe(true)
    expect(Object.keys(payload).sort()).toEqual(['events', 'formatVersion', 'mixes'])
    expect(payload.mixes[0]).not.toHaveProperty('artistIds')
    expect(payload.events[0]?.performances).toEqual([
      { artistName: 'Daft Punk', verdict: 'three-stars' },
    ])
    expect(payload.events[0]?.performances[0]).not.toHaveProperty('artistId')
  })

  it('round-trips mixes and events onto an empty account with every performance credited (AE11)', async () => {
    const payload = buildBackupExportPayload(
      [exportedMix('mix-1', 'https://youtube.com/watch?v=roundTrip1', ['Amelie Lens'])],
      [
        exportedEvent('event-1', 'Nuits Sonores', [
          storedPerformance(
            'perf-1',
            'event-1',
            'other-account-artist-1',
            'Daft Punk',
            'three-stars',
          ),
          storedPerformance('perf-2', 'event-1', 'other-account-artist-2', 'Anetha', null),
        ]),
      ],
    )

    const { artistsStore, eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(backupFile(payload))
    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result).toEqual({ added: 2, skipped: 0, failed: 0 })
    expect(eventsStore.events).toHaveLength(1)
    expect(eventsStore.events[0]?.name).toBe('Nuits Sonores')
    expect(
      eventsStore.events[0]?.performances.map((performance) => performance.artistName),
    ).toEqual(['Daft Punk', 'Anetha'])
    // Every performance credits an artist resolved on this account, never the
    // identity the file came with.
    for (const performance of eventsStore.events[0]?.performances ?? []) {
      expect(artistsStore.artists.some((artist) => artist.id === performance.artistId)).toBe(true)
      expect(performance.artistId).not.toContain('other-account-artist')
    }
    expect(artistsStore.artists.map((artist) => artist.displayName).sort()).toEqual([
      'Amelie Lens',
      'Anetha',
      'Daft Punk',
    ])
  })

  it('refuses a file in the previous bare-array shape and names the envelope, changing nothing (AE10)', async () => {
    const { artistsStore, eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(
      backupFile([exportedMix('legacy-1', 'https://youtube.com/watch?v=legacyArray1', ['Anetha'])]),
    )
    await flushPromises()

    expect(favoritesUiStore.alertDialog.visible).toBe(true)
    expect(favoritesUiStore.alertDialog.message).toContain('formatVersion')
    expect(favoritesUiStore.alertDialog.message).toContain('mixes')
    expect(favoritesUiStore.alertDialog.message).toContain('events')

    favoritesUiStore.closeAlert()
    expect(await importPromise).toBeNull()

    expect(favoritesStore.favorites).toEqual([])
    expect(eventsStore.events).toEqual([])
    expect(artistsStore.artists).toEqual([])
  })

  it('refuses a file whose version is absent or unrecognized without reading its payload (R23)', async () => {
    for (const envelope of [
      { mixes: [{ id: 'no-version', url: 'https://youtube.com/watch?v=noVersion1' }], events: [] },
      { formatVersion: 99, mixes: 'not even an array', events: [] },
      { formatVersion: '1', mixes: [], events: [] },
    ]) {
      const { favoritesStore, favoritesUiStore } = await localSession()

      const importPromise = favoritesStore.importFromFile(backupFile(envelope))
      await flushPromises()

      expect(favoritesUiStore.alertDialog.message).toContain('formatVersion')
      favoritesUiStore.closeAlert()
      expect(await importPromise).toBeNull()
      expect(favoritesStore.favorites).toEqual([])

      setActivePinia(createPinia())
      resetLocalStorageMock()
      resetPocketbaseMocks()
    }
  })

  it('gives malformed JSON, an empty file and a non-array domain key their own errors', async () => {
    const cases: { content: unknown; expected: string }[] = [
      { content: 'not valid json', expected: 'The JSON file is invalid.' },
      { content: '', expected: 'The JSON file is invalid.' },
      {
        content: { formatVersion: BACKUP_FORMAT_VERSION, mixes: {}, events: [] },
        expected: 'The JSON file is not a valid array.',
      },
      {
        content: {
          formatVersion: BACKUP_FORMAT_VERSION,
          mixes: [{ title: 'no id, no url' }],
          events: [],
        },
        expected: 'Invalid structure',
      },
      {
        content: {
          formatVersion: BACKUP_FORMAT_VERSION,
          mixes: [],
          events: [{ name: 'Nuits Sonores' }],
        },
        expected: 'Invalid structure',
      },
    ]

    for (const testCase of cases) {
      const { favoritesStore, favoritesUiStore } = await localSession()

      const importPromise = favoritesStore.importFromFile(backupFile(testCase.content))
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(favoritesUiStore.alertDialog.message).toContain(testCase.expected)
      favoritesUiStore.closeAlert()
      expect(await importPromise).toBeNull()

      setActivePinia(createPinia())
      resetLocalStorageMock()
      resetPocketbaseMocks()
    }
  })

  // A backup is hand-edited -- the rejection message tells an operator to bring
  // an older file forward by hand -- so the verdict allowlist is an
  // untrusted-input boundary. A prototype key is not a verdict, and storing one
  // verbatim takes down every surface that renders a verdict.
  it('reads a verdict off the prototype chain as no verdict, never verbatim', async () => {
    for (const smuggled of ['__proto__', 'toString', 'constructor', 'valueOf', '']) {
      const { eventsStore, favoritesStore, favoritesUiStore } = await localSession()

      const importPromise = favoritesStore.importFromFile(
        backupFile({
          formatVersion: BACKUP_FORMAT_VERSION,
          mixes: [],
          events: [
            {
              name: 'Nuits Sonores',
              dateAttended: '2026-07-12',
              venue: 'Les Subsistances',
              performances: [{ artistName: 'Daft Punk', verdict: smuggled }],
            },
          ],
        }),
      )
      await flushPromises()
      favoritesUiStore.closeAlert()
      await importPromise

      expect(eventsStore.events[0]?.performances[0]?.verdict).toBeNull()

      setActivePinia(createPinia())
      resetLocalStorageMock()
      resetPocketbaseMocks()
    }
  })

  it('refuses an event whose dateAttended is not a real bare day (KTD10)', async () => {
    for (const dateAttended of [
      'soon',
      '2026-5-4',
      '2026-05-04T00:00:00.000Z',
      '2026-05-04 00:00:00.000Z',
      '',
      '2026-13-45',
      '2026-02-30',
    ]) {
      const { eventsStore, favoritesStore, favoritesUiStore } = await localSession()

      const importPromise = favoritesStore.importFromFile(
        backupFile({
          formatVersion: BACKUP_FORMAT_VERSION,
          mixes: [],
          events: [
            {
              name: 'Nuits Sonores',
              dateAttended,
              venue: 'Les Subsistances',
              performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
            },
          ],
        }),
      )
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(favoritesUiStore.alertDialog.message).toContain('Invalid structure')
      favoritesUiStore.closeAlert()
      expect(await importPromise).toBeNull()
      expect(eventsStore.events).toEqual([])

      setActivePinia(createPinia())
      resetLocalStorageMock()
      resetPocketbaseMocks()
    }
  })

  // PocketBase's `events.name` is required, so a blank name is a row the cloud
  // will refuse anyway -- and local mode, which has no such rule, would store a
  // nameless card instead. Refusing the file names the problem while the
  // operator still has it in hand.
  it('refuses an event whose name is blank, which the events collection requires', async () => {
    for (const name of ['', '   ', '\n']) {
      const { eventsStore, favoritesStore, favoritesUiStore } = await localSession()

      const importPromise = favoritesStore.importFromFile(
        backupFile({
          formatVersion: BACKUP_FORMAT_VERSION,
          mixes: [],
          events: [
            {
              name,
              dateAttended: '2026-07-12',
              venue: 'Les Subsistances',
              performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
            },
          ],
        }),
      )
      await flushPromises()
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(favoritesUiStore.alertDialog.message).toContain('Invalid structure')
      favoritesUiStore.closeAlert()
      expect(await importPromise).toBeNull()
      expect(eventsStore.events).toEqual([])

      setActivePinia(createPinia())
      resetLocalStorageMock()
      resetPocketbaseMocks()
    }
  })

  it('accepts a leap day and every other real bare day', async () => {
    const { eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [],
        events: [
          {
            name: 'Leap Night',
            dateAttended: '2024-02-29',
            venue: 'Les Subsistances',
            performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
          },
        ],
      }),
    )
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    expect(eventsStore.events[0]?.dateAttended).toBe('2024-02-29')
  })

  it('creates the artist an imported event credits when the account does not have it', async () => {
    const { artistsStore, eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [],
        events: [
          {
            name: 'Dour Festival',
            dateAttended: '2026-07-12',
            venue: 'Dour',
            performances: [{ artistName: 'Brand New Live Act', verdict: 'one-star' }],
          },
        ],
      }),
    )
    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result).toEqual({ added: 1, skipped: 0, failed: 0 })
    expect(artistsStore.artists.map((artist) => artist.displayName)).toEqual(['Brand New Live Act'])
    expect(eventsStore.events[0]?.performances[0]?.artistId).toBe(artistsStore.artists[0]?.id)
  })

  it('folds two spellings of one name inside a line-up onto a single artist', async () => {
    const { artistsStore, eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [],
        events: [
          {
            name: 'Dour Festival',
            dateAttended: '2026-07-12',
            venue: 'Dour',
            performances: [
              { artistName: 'Amelie Lens', verdict: 'three-stars' },
              { artistName: 'amelie lens', verdict: 'two-stars' },
            ],
          },
        ],
      }),
    )
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    expect(artistsStore.artists).toHaveLength(1)
    const [first, second] = eventsStore.events[0]?.performances ?? []
    expect(first?.artistId).toBe(second?.artistId)
    expect(first?.artistId).toBe(artistsStore.artists[0]?.id)
  })

  it('leaves an event unimported rather than crediting fewer performers when an artist cannot be created', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    const init = sessionInit(true)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    await favoritesStore.initializeForCurrentSession(init)

    artistsStore.artists.push({ id: 'known-1', displayName: 'Daft Punk', slug: 'daft punk' })

    pocketbaseArtistsCollectionApi.create.mockRejectedValue({ status: 400, response: {} })
    pocketbaseArtistsCollectionApi.getFirstListItem.mockRejectedValue({ status: 404 })

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [],
        events: [
          {
            name: 'Dour Festival',
            dateAttended: '2026-07-12',
            venue: 'Dour',
            performances: [
              { artistName: 'Daft Punk', verdict: 'three-stars' },
              { artistName: 'Unresolvable Act', verdict: 'one-star' },
            ],
          },
        ],
      }),
    )
    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result).toEqual({ added: 0, skipped: 0, failed: 1 })
    expect(eventsStore.events).toEqual([])
  })

  it('refuses the whole file while the session is read-only', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    await favoritesStore.initializeForCurrentSession(init)

    expect(favoritesStore.isReadOnly).toBe(true)

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [exportedMix('mix-1', 'https://youtube.com/watch?v=readOnly1', ['Anetha'])],
        events: [
          {
            name: 'Dour Festival',
            dateAttended: '2026-07-12',
            venue: 'Dour',
            performances: [{ artistName: 'Daft Punk', verdict: null }],
          },
        ],
      }),
    )
    await flushPromises()

    expect(favoritesUiStore.alertDialog.message).toBe(
      "You're offline. Your changes are disabled until the connection is restored.",
    )
    favoritesUiStore.closeAlert()

    expect(await importPromise).toEqual({ added: 0, skipped: 2, failed: 0 })
    expect(favoritesStore.favorites).toEqual([])
    expect(eventsStore.events).toEqual([])
  })

  it('lets the mixes decide the spelling and leaves a live-only artist the performance spelling (KTD17)', async () => {
    const { artistsStore, favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [exportedMix('mix-1', 'https://youtube.com/watch?v=election1', ['Amélie Lens'])],
        events: [
          {
            name: 'Dour Festival',
            dateAttended: '2026-07-12',
            venue: 'Dour',
            performances: [
              { artistName: 'amelie lens', verdict: null },
              { artistName: 'amelie lens', verdict: null },
              { artistName: 'Nina Kraviz', verdict: null },
            ],
          },
        ],
      }),
    )
    await flushPromises()
    favoritesUiStore.closeAlert()
    await importPromise

    const byslug = new Map(artistsStore.artists.map((artist) => [artist.slug, artist.displayName]))
    // Two casual performance spellings outvote the single mix-side one on
    // count alone; KTD17 keeps them out of the election entirely.
    expect(byslug.get('amelie lens')).toBe('Amélie Lens')
    // The live-only artist has no mix-side name, so its performance spelling
    // is the only candidate and wins.
    expect(byslug.get('nina kraviz')).toBe('Nina Kraviz')
  })

  it('keeps the population election a pure projection over the two name sources (KTD17)', () => {
    expect(
      buildImportArtistPopulation(['Amélie Lens'], ['amelie lens', 'amelie lens', 'Nina Kraviz']),
    ).toEqual(['Amélie Lens', 'Nina Kraviz'])
    expect(buildImportArtistPopulation([], ['   '])).toEqual([])
  })

  it('counts every mix and every event row through the progress indicator', async () => {
    const { favoritesStore, favoritesUiStore } = await localSession()

    const importPromise = favoritesStore.importFromFile(
      backupFile({
        formatVersion: BACKUP_FORMAT_VERSION,
        mixes: [
          exportedMix('mix-1', 'https://youtube.com/watch?v=progBoth001', ['Anetha']),
          exportedMix('mix-2', 'https://youtube.com/watch?v=progBoth002', ['Anetha']),
        ],
        events: [
          {
            name: 'Dour Festival',
            dateAttended: '2026-07-12',
            venue: 'Dour',
            performances: [{ artistName: 'Anetha', verdict: null }],
          },
        ],
      }),
    )
    await flushPromises()
    favoritesUiStore.closeAlert()
    const result = await importPromise

    expect(result).toEqual({ added: 3, skipped: 0, failed: 0 })
    expect(favoritesStore.importProgress).toBeNull()
  })

  it('names a degraded session before writing a backup that would claim a half is empty', async () => {
    const { eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-04',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
    })

    // The mixes half failed to load, so `favorites` is empty because it is
    // unknown -- not because the operator keeps none.
    favoritesStore.loadFailed = true

    const written: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      written.push(blob as Blob)
      return 'blob:groovemark-backup'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const exportPromise = favoritesStore.exportFavorites()
    await flushPromises()

    expect(favoritesUiStore.confirmDialog.visible).toBe(true)
    favoritesUiStore.respondConfirm(false)
    await exportPromise

    // Declining writes no file at all: a backup the operator was warned about
    // and refused must not land on disk anyway.
    expect(written).toHaveLength(0)

    vi.restoreAllMocks()
  })

  it('exports an account holding events but no mix instead of refusing (R22)', async () => {
    const { eventsStore, favoritesStore, favoritesUiStore } = await localSession()

    const saved = await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-04',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
    })
    expect(saved).toBe(true)
    expect(favoritesStore.favorites).toEqual([])

    const written: Blob[] = []
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      written.push(blob as Blob)
      return 'blob:groovemark-backup'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await favoritesStore.exportFavorites()

    expect(favoritesUiStore.alertDialog.visible).toBe(false)
    expect(written).toHaveLength(1)

    const payload = JSON.parse(await written[0].text())
    expect(payload.formatVersion).toBe(BACKUP_FORMAT_VERSION)
    expect(payload.mixes).toEqual([])
    expect(payload.events[0]?.performances).toEqual([
      { artistName: 'Daft Punk', verdict: 'three-stars' },
    ])

    vi.restoreAllMocks()
  })
})
