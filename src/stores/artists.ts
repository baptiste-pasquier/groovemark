import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Artist } from '../types/artist'
import type { ArtistsRepository } from '../services/artistsRepository'
import { selectRepositories } from '../services/favoritesRepository'
import { LocalArtistsRepository } from '../services/localArtistsRepository'
import { findArtistByName, normalizeArtistName } from '../utils/artist'
import { useAuthStore } from './auth'

interface InitializeArtistsOptions {
  backendAvailable: boolean
  force?: boolean
}

export const useArtistsStore = defineStore('artists', () => {
  const artists = ref<Artist[]>([])
  const isLoading = ref(false)
  const initialized = ref(false)
  const loadFailed = ref(false)

  let activeArtistsRepository: ArtistsRepository | null = null
  let cacheArtistsRepository: LocalArtistsRepository | null = null
  let sessionKey = ''

  const authStore = useAuthStore()

  function getCurrentSessionKey() {
    return `${authStore.authMode ?? 'none'}:${authStore.userId ?? 'anonymous'}`
  }

  async function initializeForCurrentSession(options: InitializeArtistsOptions) {
    if (!authStore.authMode) {
      $reset()
      return
    }

    const nextSessionKey = getCurrentSessionKey()
    if (initialized.value && !options.force && sessionKey === nextSessionKey) {
      return
    }

    isLoading.value = true
    initialized.value = true
    sessionKey = nextSessionKey
    loadFailed.value = false

    const selection = selectRepositories({
      authMode: authStore.authMode,
      userId: authStore.userId,
      backendAvailable: options.backendAvailable,
    })
    activeArtistsRepository = selection.activeArtistsRepository
    cacheArtistsRepository = selection.cacheArtistsRepository

    try {
      artists.value = await activeArtistsRepository.list()
      if (selection.mode !== 'google-cache') {
        await cacheArtistsRepository.replaceAll(artists.value)
      }
    } catch (error) {
      console.error('Error initializing artists:', error)
      artists.value = []
      loadFailed.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function persistArtistsCacheSnapshot() {
    if (!cacheArtistsRepository) return
    await cacheArtistsRepository.replaceAll(artists.value)
  }

  // Pure matching lives in utils/artist.ts; this is the per-caller create
  // policy for the artist field (KTD6). Callers decide how to surface a
  // failure -- this just resolves-or-creates and returns null for a name
  // that is empty once trimmed.
  async function resolveOrCreateArtist(rawName: string): Promise<Artist | null> {
    const slug = normalizeArtistName(rawName)
    if (slug === null) return null

    const existing = findArtistByName(rawName, artists.value)
    if (existing) return existing

    if (!activeArtistsRepository) {
      throw new Error('Artists repository has not been initialized.')
    }

    try {
      const created = await activeArtistsRepository.create({ displayName: rawName.trim(), slug })
      artists.value.push(created)
      await persistArtistsCacheSnapshot()
      return created
    } catch (error) {
      // KTD7: a create rejected by the unique index (owner+slug) is treated
      // as a find -- re-read by slug and reuse the winner instead of failing.
      const found = await activeArtistsRepository.findBySlug(slug)
      if (!found) throw error

      if (!artists.value.some((artist) => artist.id === found.id)) {
        artists.value.push(found)
        await persistArtistsCacheSnapshot()
      }
      return found
    }
  }

  function $reset() {
    artists.value = []
    isLoading.value = false
    initialized.value = false
    loadFailed.value = false
    activeArtistsRepository = null
    cacheArtistsRepository = null
    sessionKey = ''
  }

  return {
    artists,
    isLoading,
    initialized,
    loadFailed,
    initializeForCurrentSession,
    persistArtistsCacheSnapshot,
    resolveOrCreateArtist,
    $reset,
  }
})
