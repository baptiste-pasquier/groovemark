import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import { useAppStore } from '../stores/app'
import { useArtistsStore } from '../stores/artists'
import { useArtistsUiStore } from '../stores/artistsUi'
import { useAuthStore } from '../stores/auth'
import { useEventsUiStore } from '../stores/eventsUi'
import { useFavoritesStore } from '../stores/favorites'
import { FavoritesRepositoryError, selectRepositories } from '../services/favoritesRepository'
import { getLocalStorageState, localStorageMock, resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'
import {
  pocketbaseArtistsCollectionApi,
  pocketbaseCollectionApi,
  resetPocketbaseMocks,
} from './mocks/pocketbase'
import type { Artist } from '../types/artist'

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

describe('Artists Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
  })

  it('keeps local-mode and authenticated artist sets separate', async () => {
    const localArtist = createArtist('local-artist-1', 'Local Artist', 'local-artist')
    const googleArtist = createArtist('google-artist-1', 'Google Artist', 'google-artist')

    localStorage.setItem('groovemark:artists:local', JSON.stringify([localArtist]))
    localStorage.setItem('groovemark:artists:google:user-1', JSON.stringify([googleArtist]))

    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    await artistsStore.initializeForCurrentSession(sessionInit(false))
    expect(artistsStore.artists).toEqual([googleArtist])

    await authStore.signOut()
    artistsStore.$reset()
    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession(sessionInit(false))

    expect(artistsStore.artists).toEqual([localArtist])
  })

  it('never lets two authenticated users see each other artists', async () => {
    const userOneArtist = createArtist('user-1-artist', 'User One Artist', 'user-one-artist')
    const userTwoArtist = createArtist('user-2-artist', 'User Two Artist', 'user-two-artist')

    localStorage.setItem('groovemark:artists:google:user-1', JSON.stringify([userOneArtist]))
    localStorage.setItem('groovemark:artists:google:user-2', JSON.stringify([userTwoArtist]))

    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await artistsStore.initializeForCurrentSession(sessionInit(false))
    expect(artistsStore.artists).toEqual([userOneArtist])

    authStore.user = createUser('user-2')
    await artistsStore.initializeForCurrentSession(sessionInit(false, { force: true }))

    expect(artistsStore.artists).toEqual([userTwoArtist])
  })

  it('signing out clears artists along with favorites', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft-punk' },
    ] as never)
    pocketbaseCollectionApi.getFullList.mockResolvedValue([
      {
        id: 'cloud-1',
        url: 'https://youtube.com/watch?v=cloud',
        title: 'Cloud favorite',
        artists: ['Daft Punk'],
        artistIds: ['artist-1'],
        type: 'youtube',
        thumbnail: 'https://img.test/thumbnail.jpg',
        timestamps: [],
        created_at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      },
    ] as never)

    await artistsStore.initializeForCurrentSession(sessionInit(true))
    await favoritesStore.initializeForCurrentSession(sessionInit(true))

    expect(artistsStore.artists).not.toEqual([])
    expect(favoritesStore.favorites).not.toEqual([])

    appStore.handleSignedOut()

    expect(artistsStore.artists).toEqual([])
    expect(artistsStore.initialized).toBe(false)
    expect(favoritesStore.favorites).toEqual([])
    expect(favoritesStore.initialized).toBe(false)
  })

  it('keeps a healthy cloud session writable when the device refuses the cache mirror', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft-punk' },
    ] as never)

    const originalSetItem = localStorageMock.setItem.getMockImplementation()
    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    try {
      await artistsStore.initializeForCurrentSession(sessionInit(true))
    } finally {
      localStorageMock.setItem.mockImplementation(originalSetItem!)
    }

    // The load itself succeeded. A device that cannot keep an offline copy
    // loses the offline copy -- not the artists it just fetched, and not the
    // right to write for the rest of the session.
    expect(artistsStore.artists).toEqual([createArtist('artist-1', 'Daft Punk', 'daft-punk')])
    expect(artistsStore.loadFailed).toBe(false)
    expect(appStore.isReadOnly).toBe(false)
  })

  it('resolves the artists cache mirror when the device refuses the write', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([] as never)
    await artistsStore.initializeForCurrentSession(sessionInit(true))
    artistsStore.addResolvedArtist(createArtist('artist-9', 'Anetha', 'anetha'))

    const originalSetItem = localStorageMock.setItem.getMockImplementation()
    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    let thrown: unknown
    try {
      await artistsStore.persistArtistsCacheSnapshot()
    } catch (error) {
      thrown = error
    } finally {
      localStorageMock.setItem.mockImplementation(originalSetItem!)
    }

    // The mirror runs on the import path, where its caller has no catch of its
    // own: rejecting here would surface as an unhandled rejection mid-import.
    expect(thrown).toBeUndefined()
  })

  it('leaves the session read-only without signing out when loading artists fails', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValue(
      new Error('artists backend unreachable'),
    )

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(authStore.authMode).toBe('google')
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('falls back to the cached artist list instead of showing an empty one when loading fails', async () => {
    const cachedArtist = createArtist('cached-1', 'Cached Artist', 'cached-artist')
    localStorage.setItem('groovemark:artists:google:user-1', JSON.stringify([cachedArtist]))

    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    // The backend looks available (health check ok, per resetPocketbaseMocks'
    // default), but the actual artists fetch still fails -- the scenario a
    // plain availability ping can't catch.
    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValue(
      new Error('artists backend unreachable'),
    )

    await artistsStore.initializeForCurrentSession(sessionInit(true))

    expect(artistsStore.artists).toEqual([cachedArtist])
    // A failed load always stays read-only, even once repopulated from
    // cache: the cache can be stale, and a writable UI over it would
    // recreate artists that already exist server-side (see
    // docs/explanation/architecture.md).
    expect(artistsStore.loadFailed).toBe(true)
    // The one read-only switch lives in the app store and reads this flag
    // directly (KTD6), so nothing has to push it into the favorites store.
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('keeps the artists read-only flag set after favorites initialize successfully', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValue(
      new Error('artists backend unreachable'),
    )
    pocketbaseCollectionApi.getFullList.mockResolvedValue([
      {
        id: 'cloud-1',
        url: 'https://youtube.com/watch?v=cloud',
        title: 'Cloud favorite',
        artists: ['Artist'],
        artistIds: [],
        type: 'youtube',
        thumbnail: 'https://img.test/thumbnail.jpg',
        timestamps: [],
        created_at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      },
    ] as never)

    await appStore.handleAuthenticatedSession()

    expect(favoritesStore.favorites).toHaveLength(1)
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('rejects an artist create at the repository in cache mode', async () => {
    const authStore = useAuthStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    const selection = selectRepositories({
      authMode: 'google',
      userId: authStore.userId,
      backendAvailable: false,
    })

    let thrown: unknown
    try {
      await selection.activeArtistsRepository.create({
        displayName: 'Daft Punk',
        slug: 'daft-punk',
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(FavoritesRepositoryError)
    expect((thrown as FavoritesRepositoryError).code).toBe('unavailable')
  })

  it('keeps a prior cloud session artists available after falling back to the cache', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft-punk' },
    ] as never)

    await artistsStore.initializeForCurrentSession(sessionInit(true))
    expect(getLocalStorageState()['groovemark:artists:google:user-1']).toContain('daft-punk')

    await artistsStore.initializeForCurrentSession(sessionInit(false, { force: true }))

    expect(artistsStore.artists.length).toBeGreaterThan(0)
    expect(artistsStore.artists.map((artist) => artist.slug)).toContain('daft-punk')
  })

  it('reuses the artist found by findBySlug when a create is rejected by the unique index (KTD7)', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await artistsStore.initializeForCurrentSession(sessionInit(true))

    pocketbaseArtistsCollectionApi.create.mockRejectedValueOnce({ status: 400, response: {} })
    pocketbaseArtistsCollectionApi.getFirstListItem.mockResolvedValueOnce({
      id: 'winner-1',
      displayName: 'New Artist',
      slug: 'new artist',
    } as never)

    const resolved = await artistsStore.resolveOrCreateArtist('New Artist')

    expect(resolved).toEqual(createArtist('winner-1', 'New Artist', 'new artist'))
    // resolveOrCreateArtist no longer registers its result -- the caller
    // (resolveArtistCredits, via addOrUpdateFavorite) only does that once
    // the favorite crediting it has actually been saved.
    expect(artistsStore.artists).toEqual([])
  })

  it('clears the events and artists UI state on sign-out', () => {
    const artistsUiStore = useArtistsUiStore()
    const eventsUiStore = useEventsUiStore()
    const appStore = useAppStore()

    eventsUiStore.setSearch('warehouse')
    artistsUiStore.setSearch('daft')
    artistsUiStore.setSort('performances')

    expect(eventsUiStore.searchTerm).toBe('warehouse')
    expect(artistsUiStore.searchTerm).toBe('daft')
    expect(artistsUiStore.sortColumn).toBe('performances')
    expect(artistsUiStore.sortDirection).toBe('desc')

    appStore.handleSignedOut()

    expect(eventsUiStore.searchTerm).toBe('')
    expect(artistsUiStore.searchTerm).toBe('')
    expect(artistsUiStore.sortColumn).toBe('artist')
    expect(artistsUiStore.sortDirection).toBe('asc')
  })

  it('clears a prior degraded read-only state on sign-out and on a fresh healthy session', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValueOnce(
      new Error('artists backend unreachable'),
    )

    await appStore.handleAuthenticatedSession()
    expect(favoritesStore.isReadOnly).toBe(true)

    await authStore.signOut()
    appStore.handleSignedOut()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    await appStore.handleAuthenticatedSession()

    expect(favoritesStore.isReadOnly).toBe(false)
  })
})
