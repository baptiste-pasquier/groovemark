import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '../i18n'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import { resetLocalStorageMock } from './mocks/localStorage'
import { resetPocketbaseMocks } from './mocks/pocketbase'

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
})
