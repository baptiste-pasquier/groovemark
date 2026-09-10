import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import { LocalFavoritesRepository } from '../services/localFavoritesRepository'
import { PocketBaseFavoritesRepository } from '../services/pocketbaseFavoritesRepository'
import type { FavoriteRecordInput } from '../services/favoritesRepository'
import { getLocalStorageState, localStorageMock, resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'
import {
  mockPocketbase,
  pocketbaseArtistsCollectionApi,
  pocketbaseCollectionApi,
  resetPocketbaseMocks,
} from './mocks/pocketbase'
import type { Artist } from '../types/artist'
import type { Favorite } from '../types/favorite'

function createFavorite(id: string, url: string): Favorite {
  return {
    id,
    url,
    title: `Favorite ${id}`,
    artists: ['Artist'],
    artistIds: [],
    type: 'youtube',
    thumbnail: 'https://img.test/thumbnail.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

function createUser(id: string): RecordModel {
  return {
    id,
    collectionId: 'users',
    collectionName: 'users',
    name: `User ${id}`,
    email: `${id}@example.com`,
  }
}

function createArtist(id: string, displayName: string, slug: string): Artist {
  return { id, displayName, slug }
}

describe('Favorites Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
  })

  it('loads only the local-mode favorites on startup', async () => {
    const localFavorite = createFavorite('local-1', 'https://youtube.com/watch?v=local')
    const googleFavorite = createFavorite('google-1', 'https://youtube.com/watch?v=google')

    localStorage.setItem('groovemark:favorites:local', JSON.stringify([localFavorite]))
    localStorage.setItem('groovemark:favorites:google:user-1', JSON.stringify([googleFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    expect(favoritesStore.favorites).toEqual([localFavorite])
  })

  it('loads PocketBase favorites and mirrors them to the user cache when available', async () => {
    const cloudFavorite = createFavorite('cloud-1', 'https://youtube.com/watch?v=cloud')
    const authStore = useAuthStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    pocketbaseCollectionApi.getFullList.mockResolvedValue([
      { ...cloudFavorite, created_at: cloudFavorite.created },
    ] as never)

    const favoritesStore = useFavoritesStore()

    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    expect(favoritesStore.favorites).toEqual([cloudFavorite])
    expect(getLocalStorageState()['groovemark:favorites:google:user-1']).toContain('cloud-1')
  })

  it('falls back to the authenticated user cache when PocketBase is unavailable', async () => {
    const cachedFavorite = createFavorite('cached-1', 'https://youtube.com/watch?v=cached')
    localStorage.setItem('groovemark:favorites:google:user-1', JSON.stringify([cachedFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    expect(favoritesStore.repositoryMode).toBe('google-cache')
    expect(favoritesStore.favorites).toEqual([cachedFavorite])
  })

  it('keeps the cached favorites when PocketBase read fails', async () => {
    const cachedFavorite = createFavorite('cached-1', 'https://youtube.com/watch?v=cached')
    localStorage.setItem('groovemark:favorites:google:user-1', JSON.stringify([cachedFavorite]))
    pocketbaseCollectionApi.getFullList.mockRejectedValue(new Error('read failed'))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    expect(favoritesStore.repositoryMode).toBe('google-cache')
    expect(favoritesStore.favorites).toEqual([cachedFavorite])
    expect(getLocalStorageState()['groovemark:favorites:google:user-1']).toContain('cached-1')
  })

  it('blocks writes while falling back to the offline cache and leaves it untouched', async () => {
    const cachedFavorite = createFavorite('cached-1', 'https://youtube.com/watch?v=cached')
    localStorage.setItem('groovemark:favorites:google:user-1', JSON.stringify([cachedFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await favoritesStore.initializeForCurrentSession(sessionInit(false))
    expect(favoritesStore.isReadOnly).toBe(true)

    const addPromise = favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=offlineAdd01',
      title: 'Offline add',
      artists: [],
      timestamps: [],
      thumbnail: '',
    })
    await flushPromises()
    favoritesUiStore.closeAlert()
    expect(await addPromise).toBe(false)

    const deletePromise = favoritesStore.deleteFavorite('cached-1')
    await flushPromises()
    favoritesUiStore.closeAlert()
    await deletePromise

    const importPromise = favoritesStore.importFavorites([
      createFavorite('offline-import-1', 'https://youtube.com/watch?v=offlineImport01'),
    ])
    await flushPromises()
    favoritesUiStore.closeAlert()
    expect(await importPromise).toEqual({ added: 0, skipped: 1, failed: 0 })

    expect(favoritesStore.favorites).toEqual([cachedFavorite])
    expect(getLocalStorageState()['groovemark:favorites:google:user-1']).toBe(
      JSON.stringify([cachedFavorite]),
    )
  })

  it('isolates local-mode favorites after signing out from a Google session', async () => {
    const localFavorite = createFavorite('local-1', 'https://youtube.com/watch?v=local')
    const googleFavorite = createFavorite('google-1', 'https://youtube.com/watch?v=google')

    localStorage.setItem('groovemark:favorites:local', JSON.stringify([localFavorite]))
    localStorage.setItem('groovemark:favorites:google:user-1', JSON.stringify([googleFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await favoritesStore.initializeForCurrentSession(sessionInit(false))
    expect(favoritesStore.favorites).toEqual([googleFavorite])

    await authStore.signOut()
    favoritesStore.$reset()
    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    expect(favoritesStore.favorites).toEqual([localFavorite])
  })

  it('keeps authenticated caches isolated between users', async () => {
    const userOneFavorite = createFavorite('user-1-fav', 'https://youtube.com/watch?v=user1')
    const userTwoFavorite = createFavorite('user-2-fav', 'https://youtube.com/watch?v=user2')

    localStorage.setItem('groovemark:favorites:google:user-1', JSON.stringify([userOneFavorite]))
    localStorage.setItem('groovemark:favorites:google:user-2', JSON.stringify([userTwoFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await favoritesStore.initializeForCurrentSession(sessionInit(false))
    expect(favoritesStore.favorites).toEqual([userOneFavorite])

    authStore.user = createUser('user-2')
    await favoritesStore.initializeForCurrentSession(sessionInit(false, { force: true }))

    expect(favoritesStore.favorites).toEqual([userTwoFavorite])
  })

  it('recomputes the YouTube thumbnail when editing a favorite URL', async () => {
    const originalFavorite = createFavorite('local-1', 'https://youtube.com/watch?v=oldVideo01A')
    originalFavorite.thumbnail = 'https://img.test/original-thumbnail.jpg'
    localStorage.setItem('groovemark:favorites:local', JSON.stringify([originalFavorite]))

    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession(sessionInit(false))
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const success = await favoritesStore.addOrUpdateFavorite({
      id: originalFavorite.id,
      url: 'https://youtube.com/watch?v=newVideo02B',
      title: originalFavorite.title,
      artists: [...originalFavorite.artists],
      timestamps: [...originalFavorite.timestamps],
      thumbnail: originalFavorite.thumbnail,
    })

    expect(success).toBe(true)
    expect(favoritesStore.favorites[0]?.thumbnail).toBe(
      'https://i.ytimg.com/vi/newVideo02B/hqdefault.jpg',
    )
  })

  it('defaults artistIds to [] for a pre-existing favorite with no artistIds field, without crashing the filter/count getters', async () => {
    const legacyFavorite = {
      id: 'legacy-1',
      url: 'https://youtube.com/watch?v=legacy',
      title: 'Legacy favorite',
      artists: ['Old Artist'],
      type: 'youtube',
      thumbnail: 'https://img.test/thumbnail.jpg',
      timestamps: [],
      created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    } as unknown as Favorite
    localStorage.setItem('groovemark:favorites:local', JSON.stringify([legacyFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    expect(favoritesStore.favorites[0]?.artistIds).toEqual([])

    expect(() => favoritesUiStore.filteredFavorites).not.toThrow()
    expect(() => favoritesUiStore.mixAggregatesByArtist).not.toThrow()
    expect(favoritesUiStore.filteredFavorites.map((favorite) => favorite.id)).toContain('legacy-1')
    expect(favoritesUiStore.mixAggregatesByArtist).toEqual({})
  })

  it('deletes a favorite when confirmed in a normal (non-read-only) mode', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    await favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=deleteMe0001',
      title: 'To delete',
      artists: [],
      timestamps: [],
      thumbnail: '',
    })
    const [favorite] = favoritesStore.favorites
    expect(favorite).toBeDefined()

    const deletePromise = favoritesStore.deleteFavorite(favorite.id)
    await flushPromises()
    favoritesUiStore.respondConfirm(true)
    await deletePromise

    expect(favoritesStore.favorites).toEqual([])
    expect(getLocalStorageState()['groovemark:favorites:local']).toBe('[]')
  })

  it('does not classify lookalike SoundCloud hosts as SoundCloud favorites', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession(sessionInit(false))
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const success = await favoritesStore.addOrUpdateFavorite({
      url: 'https://evil-soundcloud.com/artist/track?utm_source=test',
      title: 'Lookalike host',
      artists: ['Artist'],
      timestamps: [],
      thumbnail: '',
    })

    expect(success).toBe(true)
    expect(favoritesStore.favorites[0]?.type).toBe('youtube')
    expect(favoritesStore.favorites[0]?.url).toBe(
      'https://evil-soundcloud.com/artist/track?utm_source=test',
    )
  })

  it('credits the existing artist regardless of the typed case, with no duplicate created (AE1)', async () => {
    const existingArtist = createArtist('artist-1', 'Amelie Lens', 'amelie lens')
    localStorage.setItem('groovemark:artists:local', JSON.stringify([existingArtist]))

    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession(sessionInit(false))
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const success = await favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=ae1TestVideo',
      title: 'AE1 test',
      artists: ['AMELIE LENS'],
      timestamps: [],
      thumbnail: '',
    })

    expect(success).toBe(true)
    expect(favoritesStore.favorites[0]?.artistIds).toEqual(['artist-1'])
    // KTD12: the denormalized `artists` column carries the resolved display
    // name, not the raw spelling the user typed.
    expect(favoritesStore.favorites[0]?.artists).toEqual(['Amelie Lens'])
    expect(artistsStore.artists).toHaveLength(1)
  })

  it('dedups two spellings of the same artist typed in a single save (AE7)', async () => {
    const existingArtist = createArtist('artist-1', 'Amelie Lens', 'amelie lens')
    localStorage.setItem('groovemark:artists:local', JSON.stringify([existingArtist]))

    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession(sessionInit(false))
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const success = await favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=ae7TestVideo',
      title: 'AE7 test',
      artists: ['Amelie Lens', 'AMELIE LENS'],
      timestamps: [],
      thumbnail: '',
    })

    expect(success).toBe(true)
    expect(favoritesStore.favorites[0]?.artistIds).toEqual(['artist-1'])
    expect(favoritesStore.favorites[0]?.artists).toEqual(['Amelie Lens'])
    expect(artistsStore.artists).toHaveLength(1)
  })

  it('drops an artist field entry that is empty once trimmed, creating no artist (AE8)', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession(sessionInit(false))
    await favoritesStore.initializeForCurrentSession(sessionInit(false))

    const success = await favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=ae8TestVideo',
      title: 'AE8 test',
      artists: ['   ', 'Real Artist'],
      timestamps: [],
      thumbnail: '',
    })

    expect(success).toBe(true)
    expect(favoritesStore.favorites[0]?.artists).toEqual(['Real Artist'])
    expect(favoritesStore.favorites[0]?.artistIds).toHaveLength(1)
    expect(artistsStore.artists).toHaveLength(1)
  })
})

describe('Favorites Store artist resolution failures', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
  })

  it('shows the save-error alert and never calls the favorites repository when resolution fails', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await artistsStore.initializeForCurrentSession(sessionInit(true))
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    pocketbaseArtistsCollectionApi.create.mockRejectedValue(new Error('create failed'))

    const addPromise = favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=resolutionFail',
      title: 'Resolution failure',
      artists: ['New Artist'],
      timestamps: [],
      thumbnail: '',
    })
    await flushPromises()
    favoritesUiStore.closeAlert()
    const success = await addPromise

    expect(success).toBe(false)
    expect(pocketbaseCollectionApi.create).not.toHaveBeenCalled()
    expect(favoritesStore.favorites).toEqual([])
  })

  it('does not surface a newly-created artist as a suggestion when the favorite save itself fails', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await artistsStore.initializeForCurrentSession(sessionInit(true))
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    const artistsWriteCallsAfterInit = localStorageMock.setItem.mock.calls.filter(
      ([key]) => key === 'groovemark:artists:google:user-1',
    ).length

    // Artist creation succeeds, but the favorite it's meant to credit fails
    // to save -- the artist must not appear as a suggestion for a save the
    // user never completed.
    pocketbaseCollectionApi.create.mockRejectedValue(new Error('favorite save failed'))

    const addPromise = favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=favoriteSaveFail',
      title: 'Favorite save failure',
      artists: ['New Artist'],
      timestamps: [],
      thumbnail: '',
    })
    await flushPromises()
    favoritesUiStore.closeAlert()
    const success = await addPromise

    expect(success).toBe(false)
    expect(artistsStore.artists).toEqual([])
    // persistArtistsCacheSnapshot only writes when something was actually
    // registered -- the failed save must not add a write beyond the one
    // already done at session init.
    const artistsWriteCallsAfterFailedSave = localStorageMock.setItem.mock.calls.filter(
      ([key]) => key === 'groovemark:artists:google:user-1',
    ).length
    expect(artistsWriteCallsAfterFailedSave).toBe(artistsWriteCallsAfterInit)
  })
})

describe('PocketBaseFavoritesRepository', () => {
  // Distinct from the mock's hardcoded `created` default (2024-01-01) so a test can't
  // pass by accident if the mapping reads the collection's own `created` field instead
  // of `created_at`.
  const INPUT_CREATED_AT = '2020-05-15T10:30:00.000Z'

  beforeEach(() => {
    resetPocketbaseMocks()
    mockPocketbase.authStore.model = { id: 'user-1' }
  })

  const repository = new PocketBaseFavoritesRepository()

  function recordInput(overrides: Partial<FavoriteRecordInput> = {}): FavoriteRecordInput {
    return {
      url: 'https://youtube.com/watch?v=abc',
      title: 'Test favorite',
      artists: [],
      artistIds: [],
      type: 'youtube',
      thumbnail: '',
      timestamps: [],
      ...overrides,
    }
  }

  it('sends the input creation date as created_at and returns it on Favorite.created', async () => {
    const result = await repository.create(recordInput({ created: INPUT_CREATED_AT }))

    expect(pocketbaseCollectionApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ created_at: INPUT_CREATED_AT }),
    )
    expect(result.created).toBe(INPUT_CREATED_AT)
  })

  it('defaults created_at to the current time when no creation date is supplied', async () => {
    const before = Date.now()

    const result = await repository.create(recordInput())

    const after = Date.now()
    const createdTime = new Date(result.created ?? '').getTime()
    expect(createdTime).toBeGreaterThanOrEqual(before)
    expect(createdTime).toBeLessThanOrEqual(after)
  })

  it('defaults created_at to the current time when the supplied creation date is empty', async () => {
    const before = Date.now()

    const result = await repository.create(recordInput({ created: '' }))

    const after = Date.now()
    const sentPayload = pocketbaseCollectionApi.create.mock.calls[0]?.[0]
    const sentCreatedAt = (sentPayload as { created_at?: string } | undefined)?.created_at
    expect(sentCreatedAt).not.toBe('')
    const createdTime = new Date(sentCreatedAt ?? '').getTime()
    expect(createdTime).toBeGreaterThanOrEqual(before)
    expect(createdTime).toBeLessThanOrEqual(after)
    expect(new Date(result.created ?? '').getTime()).toBeGreaterThanOrEqual(before)
  })

  it('never sends created_at when updating a favorite, and returns the preserved created date', async () => {
    pocketbaseCollectionApi.update.mockImplementationOnce((id, data) =>
      Promise.resolve({ id, created_at: INPUT_CREATED_AT, ...data }),
    )

    const result = await repository.update('record-1', recordInput({ created: INPUT_CREATED_AT }))

    const sentPayload = pocketbaseCollectionApi.update.mock.calls[0]?.[1]
    expect(sentPayload).not.toHaveProperty('created_at')
    expect(result.created).toBe(INPUT_CREATED_AT)
  })

  it('maps a listed record created_at onto Favorite.created', async () => {
    pocketbaseCollectionApi.getFullList.mockResolvedValue([
      { ...recordInput(), id: 'record-1', created_at: INPUT_CREATED_AT },
    ] as never)

    const [favorite] = await repository.list()

    expect(favorite?.created).toBe(INPUT_CREATED_AT)
  })

  it('defaults artists, artistIds, and timestamps to [] for a listed record missing those fields', async () => {
    const recordWithoutArrays: Partial<FavoriteRecordInput> = recordInput()
    delete recordWithoutArrays.artists
    delete recordWithoutArrays.artistIds
    delete recordWithoutArrays.timestamps

    pocketbaseCollectionApi.getFullList.mockResolvedValue([
      { ...recordWithoutArrays, id: 'record-1', created_at: INPUT_CREATED_AT },
    ] as never)

    const [favorite] = await repository.list()

    expect(favorite?.artists).toEqual([])
    expect(favorite?.artistIds).toEqual([])
    expect(favorite?.timestamps).toEqual([])
  })
})

// Characterization of the read-only switch as it behaved before it moved to
// the app store (U5). Every assertion here was green against the favorites
// store owning `degradedReadOnly` itself, so a regression in the move shows
// up as a failing assertion rather than as a silent change of behaviour.
describe('Mixes read-only switch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  function signInAsGoogleUser() {
    const authStore = useAuthStore()
    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    return authStore
  }

  it('puts the mixes half in read-only when the artists load fails', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValue(new Error('artists unreachable'))

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('puts the mixes half in read-only when the favorites load fails and artists load fine', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft-punk' },
    ] as never)
    pocketbaseCollectionApi.getFullList.mockRejectedValue(new Error('favorites unreachable'))

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(artistsStore.loadFailed).toBe(false)
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('refuses adding, editing, deleting and importing a mix with the offline message', async () => {
    signInAsGoogleUser()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    localStorage.setItem(
      'groovemark:favorites:google:user-1',
      JSON.stringify([createFavorite('cached-1', 'https://youtube.com/watch?v=cached')]),
    )

    await favoritesStore.initializeForCurrentSession(sessionInit(false))
    expect(favoritesStore.isReadOnly).toBe(true)

    const readOnlyMessage =
      "You're offline. Your changes are disabled until the connection is restored."

    const addPromise = favoritesStore.addOrUpdateFavorite({
      url: 'https://youtube.com/watch?v=offlineAdd01',
      title: 'Offline add',
      artists: [],
      timestamps: [],
      thumbnail: '',
    })
    await flushPromises()
    expect(favoritesUiStore.alertDialog.message).toBe(readOnlyMessage)
    favoritesUiStore.closeAlert()
    expect(await addPromise).toBe(false)

    const editPromise = favoritesStore.addOrUpdateFavorite({
      id: 'cached-1',
      url: 'https://youtube.com/watch?v=cached',
      title: 'Renamed offline',
      artists: [],
      timestamps: [],
      thumbnail: '',
    })
    await flushPromises()
    expect(favoritesUiStore.alertDialog.message).toBe(readOnlyMessage)
    favoritesUiStore.closeAlert()
    expect(await editPromise).toBe(false)

    const deletePromise = favoritesStore.deleteFavorite('cached-1')
    await flushPromises()
    expect(favoritesUiStore.alertDialog.message).toBe(readOnlyMessage)
    favoritesUiStore.closeAlert()
    await deletePromise

    const importPromise = favoritesStore.importFavorites([
      createFavorite('offline-import-1', 'https://youtube.com/watch?v=offlineImport01'),
    ])
    await flushPromises()
    expect(favoritesUiStore.alertDialog.message).toBe(readOnlyMessage)
    favoritesUiStore.closeAlert()
    expect(await importPromise).toEqual({ added: 0, skipped: 1, failed: 0 })

    expect(favoritesStore.favorites).toEqual([
      createFavorite('cached-1', 'https://youtube.com/watch?v=cached'),
    ])
  })

  it('leaves the session signed in and read-only when the favorites cache is unreadable too', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseCollectionApi.getFullList.mockRejectedValue(new Error('favorites unreachable'))
    vi.spyOn(LocalFavoritesRepository.prototype, 'list').mockRejectedValue(
      new Error('favorites cache unreadable'),
    )

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(authStore.authMode).toBe('google')
    expect(favoritesStore.favorites).toEqual([])
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('clears read-only once a degraded session reloads healthy', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValueOnce(
      new Error('artists unreachable'),
    )

    await appStore.handleAuthenticatedSession()
    expect(favoritesStore.isReadOnly).toBe(true)

    await appStore.handleAuthenticatedSession()

    expect(favoritesStore.isReadOnly).toBe(false)
  })
})
