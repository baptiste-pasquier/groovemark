import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'
import { pocketbaseCollectionApi, resetPocketbaseMocks } from './mocks/pocketbase'
import type { Favorite } from '../types/favorite'

function createFavorite(id: string, url: string): Favorite {
  return {
    id,
    url,
    title: `Favorite ${id}`,
    artists: ['Artist'],
    type: 'youtube',
    thumbnail: 'https://img.test/thumbnail.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

function createUser(id: string): RecordModel {
  return {
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
  }
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
    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })

    expect(favoritesStore.favorites).toEqual([localFavorite])
  })

  it('loads PocketBase favorites and mirrors them to the user cache when available', async () => {
    const cloudFavorite = createFavorite('cloud-1', 'https://youtube.com/watch?v=cloud')
    const authStore = useAuthStore()

    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    pocketbaseCollectionApi.getFullList.mockResolvedValue([cloudFavorite] as never)

    const favoritesStore = useFavoritesStore()

    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

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

    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })

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

    await favoritesStore.initializeForCurrentSession({ backendAvailable: true })

    expect(favoritesStore.repositoryMode).toBe('google-cache')
    expect(favoritesStore.favorites).toEqual([cachedFavorite])
    expect(getLocalStorageState()['groovemark:favorites:google:user-1']).toContain('cached-1')
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

    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })
    expect(favoritesStore.favorites).toEqual([googleFavorite])

    await authStore.signOut()
    favoritesStore.$reset()
    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })

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

    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })
    expect(favoritesStore.favorites).toEqual([userOneFavorite])

    authStore.user = createUser('user-2')
    await favoritesStore.initializeForCurrentSession({ backendAvailable: false, force: true })

    expect(favoritesStore.favorites).toEqual([userTwoFavorite])
  })

  it('recomputes the YouTube thumbnail when editing a favorite URL', async () => {
    const originalFavorite = createFavorite('local-1', 'https://youtube.com/watch?v=oldVideo01A')
    originalFavorite.thumbnail = 'https://img.test/original-thumbnail.jpg'
    localStorage.setItem('groovemark:favorites:local', JSON.stringify([originalFavorite]))

    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.continueInLocalMode()
    await favoritesStore.initializeForCurrentSession({ backendAvailable: false })

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
})
