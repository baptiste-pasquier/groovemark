import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import type { AppStatus } from '../types/app'
import { useArtistsStore } from './artists'
import { useAuthStore } from './auth'
import { useFavoritesStore } from './favorites'
import { useFavoritesUiStore } from './favoritesUi'
import { PocketBaseFavoritesRepository } from '../services/pocketbaseFavoritesRepository'

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

  async function bootstrap() {
    if (isBootstrapped.value) return

    status.value = 'booting'

    try {
      await authStore.initialize()
      await refreshBackendAvailability()

      if (authStore.isLoggedIn) {
        await Promise.all([
          artistsStore.initializeForCurrentSession({
            backendAvailable: backendAvailable.value,
          }),
          favoritesStore.initializeForCurrentSession({
            backendAvailable: backendAvailable.value,
          }),
        ])
        favoritesStore.setDegradedReadOnly(artistsStore.loadFailed)
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
      await Promise.all([
        artistsStore.initializeForCurrentSession({
          backendAvailable: backendAvailable.value,
          force: true,
        }),
        favoritesStore.initializeForCurrentSession({
          backendAvailable: backendAvailable.value,
          force: true,
        }),
      ])
      favoritesStore.setDegradedReadOnly(artistsStore.loadFailed)
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
