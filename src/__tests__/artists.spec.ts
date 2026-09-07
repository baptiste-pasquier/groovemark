import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import { useAppStore } from '../stores/app'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { FavoritesRepositoryError, selectRepositories } from '../services/favoritesRepository'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'
import { mockPocketbase, pocketbaseCollectionApi, resetPocketbaseMocks } from './mocks/pocketbase'
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

// The shared pocketbase mock resolves `collection()` to the same object no matter
// what collection name it is called with, so favorites and artists calls can't be
// told apart there. Route calls for the 'artists' collection to a repository-local
// mock so favorites and artists behavior can be controlled independently.
const artistsCollectionApi = {
  getFullList: vi.fn(() => Promise.resolve([])),
  create: vi.fn((data: unknown) => Promise.resolve({ id: 'mock-artist-id', ...(data as object) })),
  update: vi.fn(),
  delete: vi.fn(),
  authWithOAuth2: vi.fn(),
}

function routeArtistsCollectionCalls() {
  mockPocketbase.collection.mockImplementation((name?: string) =>
    name === 'artists' ? artistsCollectionApi : pocketbaseCollectionApi,
  )
}

describe('Artists Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    artistsCollectionApi.getFullList.mockReset()
    artistsCollectionApi.getFullList.mockResolvedValue([])
    artistsCollectionApi.create.mockReset()
    artistsCollectionApi.create.mockImplementation((data: unknown) =>
      Promise.resolve({ id: 'mock-artist-id', ...(data as object) }),
    )
    routeArtistsCollectionCalls()
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
    await artistsStore.initializeForCurrentSession({ backendAvailable: false })
    expect(artistsStore.artists).toEqual([googleArtist])

    await authStore.signOut()
    artistsStore.$reset()
    authStore.continueInLocalMode()
    await artistsStore.initializeForCurrentSession({ backendAvailable: false })

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

    await artistsStore.initializeForCurrentSession({ backendAvailable: false })
    expect(artistsStore.artists).toEqual([userOneArtist])

    authStore.user = createUser('user-2')
    await artistsStore.initializeForCurrentSession({ backendAvailable: false, force: true })

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

    artistsCollectionApi.getFullList.mockResolvedValue([
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

    await artistsStore.initializeForCurrentSession({ backendAvailable: true })
    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    expect(artistsStore.artists).not.toEqual([])
    expect(favoritesStore.favorites).not.toEqual([])

    appStore.handleSignedOut()

    expect(artistsStore.artists).toEqual([])
    expect(artistsStore.initialized).toBe(false)
    expect(favoritesStore.favorites).toEqual([])
    expect(favoritesStore.initialized).toBe(false)
  })

  it('leaves the session read-only without signing out when loading artists fails', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    artistsCollectionApi.getFullList.mockRejectedValue(new Error('artists backend unreachable'))

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(authStore.authMode).toBe('google')
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('keeps the artists read-only flag set after favorites initialize successfully', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    artistsCollectionApi.getFullList.mockRejectedValue(new Error('artists backend unreachable'))
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

    artistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft-punk' },
    ] as never)

    await artistsStore.initializeForCurrentSession({ backendAvailable: true })
    expect(getLocalStorageState()['groovemark:artists:google:user-1']).toContain('daft-punk')

    await artistsStore.initializeForCurrentSession({ backendAvailable: false, force: true })

    expect(artistsStore.artists.length).toBeGreaterThan(0)
    expect(artistsStore.artists.map((artist) => artist.slug)).toContain('daft-punk')
  })

  it('clears a prior degraded read-only state on sign-out and on a fresh healthy session', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()
    const appStore = useAppStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')

    artistsCollectionApi.getFullList.mockRejectedValueOnce(new Error('artists backend unreachable'))

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
