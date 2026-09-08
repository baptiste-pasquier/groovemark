import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import type { AppStatus } from '../types/app'
import { useArtistsStore } from './artists'
import { useAuthStore } from './auth'
import { useFavoritesStore } from './favorites'
import { useFavoritesUiStore } from './favoritesUi'
import { PocketBaseFavoritesRepository } from '../services/pocketbaseFavoritesRepository'
import { selectRepositories } from '../services/favoritesRepository'

export const useAppStore = defineStore('app', () => {
  const status = ref<AppStatus>('booting')
  const backendAvailable = ref(true)
  const isBootstrapped = ref(false)

  const authStore = useAuthStore()
  const artistsStore = useArtistsStore()
  const favoritesStore = useFavoritesStore()
  const favoritesUiStore = useFavoritesUiStore()
  const pocketBaseRepository = new PocketBaseFavoritesRepository()

  async function refreshBackendAvailability() {
    backendAvailable.value = await pocketBaseRepository.isAvailable()
  }

  // Computes the repository selection exactly once per session-init call and
  // hands the same object to both stores, so favorites and artists can never
  // independently resolve a different mode for the same session (KTD13).
  async function initializeStoresForSession(options: { force?: boolean }) {
    if (!authStore.authMode) {
      throw new Error('Cannot initialize session repositories without an auth mode.')
    }

    const selection = selectRepositories({
      authMode: authStore.authMode,
      userId: authStore.userId,
      backendAvailable: backendAvailable.value,
    })

    await Promise.all([
      artistsStore.initializeForCurrentSession({ selection, force: options.force }),
      favoritesStore.initializeForCurrentSession({ selection, force: options.force }),
    ])
    favoritesStore.setDegradedReadOnly(artistsStore.loadFailed)
  }

  async function bootstrap() {
    if (isBootstrapped.value) return

    status.value = 'booting'

    try {
      await authStore.initialize()
      await refreshBackendAvailability()

      if (authStore.isLoggedIn) {
        await initializeStoresForSession({})
        status.value = 'ready'
      } else {
        handleSignedOut()
      }
    } catch (error) {
      await recoverFromSessionError('Error bootstrapping app:', error)
    } finally {
      isBootstrapped.value = true
    }
  }

  async function handleAuthenticatedSession() {
    status.value = 'booting'

    try {
      await refreshBackendAvailability()
      await initializeStoresForSession({ force: true })
      status.value = 'ready'
    } catch (error) {
      await recoverFromSessionError('Error initializing authenticated session:', error)
    }
  }

  async function recoverFromSessionError(logMessage: string, error: unknown) {
    console.error(logMessage, error)
    await authStore.signOut()
    handleSignedOut()
    void favoritesUiStore.showAlert(i18n.global.t('messages.error_session_init'), 'alert')
  }

  function handleSignedOut() {
    artistsStore.$reset()
    favoritesStore.$reset()
    favoritesUiStore.$reset()
    status.value = 'unauthenticated'
  }

  return {
    status,
    backendAvailable,
    isBootstrapped,
    bootstrap,
    handleAuthenticatedSession,
    handleSignedOut,
    refreshBackendAvailability,
  }
})
