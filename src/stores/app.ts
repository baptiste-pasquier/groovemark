import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppStatus } from '../types/app'
import { useAuthStore } from './auth'
import { useFavoritesStore } from './favorites'
import { useFavoritesUiStore } from './favoritesUi'
import { PocketBaseFavoritesRepository } from '../services/pocketbaseFavoritesRepository'

export const useAppStore = defineStore('app', () => {
  const status = ref<AppStatus>('booting')
  const backendAvailable = ref(true)
  const isBootstrapped = ref(false)

  const authStore = useAuthStore()
  const favoritesStore = useFavoritesStore()
  const favoritesUiStore = useFavoritesUiStore()
  const pocketBaseRepository = new PocketBaseFavoritesRepository()

  async function refreshBackendAvailability() {
    backendAvailable.value = await pocketBaseRepository.isAvailable()
  }

  async function bootstrap() {
    if (isBootstrapped.value) return

    status.value = 'booting'
    await authStore.initialize()
    await refreshBackendAvailability()

    if (authStore.isLoggedIn) {
      await favoritesStore.initializeForCurrentSession({
        backendAvailable: backendAvailable.value,
      })
      status.value = 'ready'
    } else {
      favoritesStore.$reset()
      favoritesUiStore.$reset()
      status.value = 'unauthenticated'
    }

    isBootstrapped.value = true
  }

  async function handleAuthenticatedSession() {
    status.value = 'booting'
    await refreshBackendAvailability()
    await favoritesStore.initializeForCurrentSession({
      backendAvailable: backendAvailable.value,
      force: true,
    })
    status.value = 'ready'
  }

  function handleSignedOut() {
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
