import { defineStore } from 'pinia'
import { computed, ref, type ComputedRef } from 'vue'
import i18n from '../i18n'
import type { AppStatus } from '../types/app'
import { useArtistsStore } from './artists'
import { useArtistsUiStore } from './artistsUi'
import { useAuthStore } from './auth'
import { useEventsStore } from './events'
import { useEventsUiStore } from './eventsUi'
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
  const artistsUiStore = useArtistsUiStore()
  const eventsStore = useEventsStore()
  const eventsUiStore = useEventsUiStore()
  const favoritesStore = useFavoritesStore()
  const favoritesUiStore = useFavoritesUiStore()
  const pocketBaseRepository = new PocketBaseFavoritesRepository()

  // The one switch deciding whether this session is read-only (R8, KTD6). It
  // lives here because this store already owns backend availability and boot
  // state, and because two independent switches could disagree and accept an
  // offline write that reconnecting would discard.
  //
  // It reads two kinds of input from every domain, not one:
  //  - each domain's load-failure flag, so a load that fell back to a
  //    possibly-stale cache never leaves the app writable over it;
  //  - each domain's *effective* mode, which is not always the mode the
  //    session started in -- the favorites store rewrites its own to
  //    'google-cache' after a failed cloud load, and the events store reports
  //    the same through `effectiveMode`.
  // Fed only a load-failure flag, this switch would leave a session writable
  // in which one half is already a stale snapshot; fed only the modes, it
  // would miss a fallback that repopulated from cache without changing mode.
  //
  // The artists store reports no mode of its own on purpose: one
  // selectRepositories call hands all three domains the same initial mode
  // (KTD5), and the only way artists can diverge from it afterwards is its own
  // fallback -- which `loadFailed` already says.
  const isReadOnly: ComputedRef<boolean> = computed(
    () =>
      artistsStore.loadFailed ||
      favoritesStore.loadFailed ||
      eventsStore.loadFailed ||
      favoritesStore.repositoryMode === 'google-cache' ||
      eventsStore.effectiveMode === 'google-cache',
  )

  async function refreshBackendAvailability(): Promise<void> {
    backendAvailable.value = await pocketBaseRepository.isAvailable()
  }

  // Computes the repository selection exactly once per session-init call and
  // hands the same object to all three domain stores, so favorites, artists
  // and events can never independently resolve a different mode for the same
  // session (KTD5).
  async function initializeStoresForSession(options: { force?: boolean }): Promise<void> {
    if (!authStore.authMode) {
      throw new Error('Cannot initialize session repositories without an auth mode.')
    }

    const selection = selectRepositories({
      authMode: authStore.authMode,
      userId: authStore.userId,
      backendAvailable: backendAvailable.value,
    })

    // Every domain store swallows its own load failure and reports it through
    // `loadFailed` / its effective mode, which `isReadOnly` above reads. That
    // is deliberate: a rejection here would skip the rest of bootstrap and
    // land in recoverFromSessionError, which signs the operator out -- so one
    // unreadable events or favorites blob would end a session whose other
    // halves loaded perfectly.
    await Promise.all([
      artistsStore.initializeForCurrentSession({ selection, force: options.force }),
      favoritesStore.initializeForCurrentSession({ selection, force: options.force }),
      eventsStore.initializeForCurrentSession({ selection, force: options.force }),
    ])
  }

  async function bootstrap(): Promise<void> {
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

  async function handleAuthenticatedSession(): Promise<void> {
    status.value = 'booting'

    try {
      await refreshBackendAvailability()
      await initializeStoresForSession({ force: true })
      status.value = 'ready'
    } catch (error) {
      await recoverFromSessionError('Error initializing authenticated session:', error)
    }
  }

  async function recoverFromSessionError(logMessage: string, error: unknown): Promise<void> {
    console.error(logMessage, error)
    await authStore.signOut()
    handleSignedOut()
    void favoritesUiStore.showAlert(i18n.global.t('messages.error_session_init'), 'alert')
  }

  // Every store holding session state is reset here, the UI ones included. A
  // search box left set would survive into the next account on the same device
  // and silently filter its list, because the inputs are uncontrolled and would
  // still render empty; the artists table would likewise keep the previous
  // session's sort.
  function handleSignedOut(): void {
    artistsStore.$reset()
    artistsUiStore.$reset()
    eventsStore.$reset()
    eventsUiStore.$reset()
    favoritesStore.$reset()
    favoritesUiStore.$reset()
    status.value = 'unauthenticated'
  }

  return {
    status,
    backendAvailable,
    isBootstrapped,
    isReadOnly,
    bootstrap,
    handleAuthenticatedSession,
    handleSignedOut,
    refreshBackendAvailability,
  }
})
