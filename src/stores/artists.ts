import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Artist } from '../types/artist'
import type { ArtistsRepository } from '../services/artistsRepository'
import type { SessionInitOptions } from '../services/favoritesRepository'
import { LocalArtistsRepository } from '../services/localArtistsRepository'
import { createOrFindArtist, normalizeArtistName } from '../utils/artist'
import { createSessionGuard } from '../utils/sessionGuard'
import { useAuthStore } from './auth'

export const useArtistsStore = defineStore('artists', () => {
  const artists = ref<Artist[]>([])
  const isLoading = ref(false)
  const initialized = ref(false)
  const loadFailed = ref(false)

  let activeArtistsRepository: ArtistsRepository | null = null
  let cacheArtistsRepository: LocalArtistsRepository | null = null
  // Set whenever `artists.value` changes in a way the local cache mirror
  // does not yet reflect, so persistArtistsCacheSnapshot can skip the write
  // when nothing actually changed since the last one.
  let cacheDirty = false
  const sessionGuard = createSessionGuard()

  const authStore = useAuthStore()

  // O(1) slug lookup for resolveOrCreateArtist instead of scanning the whole
  // array on every credited artist name, on every favorite save. Vue only
  // rebuilds this when `artists.value` itself changes.
  const artistsBySlug = computed(
    () => new Map(artists.value.map((artist) => [artist.slug, artist])),
  )

  async function initializeForCurrentSession(options: SessionInitOptions) {
    if (!authStore.authMode) {
      $reset()
      return
    }

    if (sessionGuard.shouldSkip(authStore, initialized.value, options.force ?? false)) {
      return
    }

    isLoading.value = true
    initialized.value = true
    loadFailed.value = false

    activeArtistsRepository = options.selection.activeArtistsRepository
    cacheArtistsRepository = options.selection.cacheArtistsRepository

    try {
      artists.value = await activeArtistsRepository.list()
      if (options.selection.mode !== 'google-cache') {
        await cacheArtistsRepository.replaceAll(artists.value)
      }
    } catch (error) {
      console.error('Error initializing artists:', error)
      // A failed load never shows an empty artist list and always puts the
      // session into read-only mode (loadFailed is one of the app store's
      // read-only inputs):
      // a writable UI over a stale or empty resolution index would recreate
      // artists that already exist server-side and collide with the
      // (owner, slug) unique index. See docs/explanation/architecture.md.
      loadFailed.value = true
      if (options.selection.mode === 'google-cloud' && cacheArtistsRepository) {
        try {
          artists.value = await cacheArtistsRepository.list()
          activeArtistsRepository = cacheArtistsRepository
        } catch (cacheError) {
          console.error('Error loading artists from cache fallback:', cacheError)
          artists.value = []
        }
      } else {
        artists.value = []
      }
    } finally {
      isLoading.value = false
    }
  }

  async function persistArtistsCacheSnapshot() {
    if (!cacheArtistsRepository || !cacheDirty) return
    await cacheArtistsRepository.replaceAll(artists.value)
    cacheDirty = false
  }

  // Registers an artist resolved elsewhere (e.g. the import path in
  // favorites.ts) into the in-memory set, without persisting -- callers
  // persist once after they're done resolving a whole batch. Returns
  // whether it actually added anything, so a caller only bothers persisting
  // when something changed.
  function addResolvedArtist(artist: Artist): boolean {
    if (artists.value.some((existing) => existing.id === artist.id)) {
      return false
    }
    artists.value.push(artist)
    cacheDirty = true
    return true
  }

  // Pure matching lives in utils/artist.ts; this is the per-caller create
  // policy for the artist field (KTD6). Callers decide how to surface a
  // failure -- this just resolves-or-creates and returns null for a name
  // that is empty once trimmed. It does NOT register the result into the
  // store: a favorite save that goes on to fail after this resolves would
  // otherwise leave a newly-created artist visible as a suggestion while
  // crediting nothing. The caller (resolveArtistCredits) registers it only
  // once the favorite it's for has actually been saved.
  async function resolveOrCreateArtist(rawName: string): Promise<Artist | null> {
    const slug = normalizeArtistName(rawName)
    if (slug === null) return null

    const existing = artistsBySlug.value.get(slug)
    if (existing) return existing

    if (!activeArtistsRepository) {
      throw new Error('Artists repository has not been initialized.')
    }
    const repository = activeArtistsRepository

    // Race-recovery mechanics (KTD7) live in createOrFindArtist; a failure
    // here (including the fallback find itself failing, e.g. a genuine
    // network error rather than a clean "not found") must not mask the
    // original create error, so a fallback-find failure is swallowed and
    // logged here -- the same protection the import path already has.
    return await createOrFindArtist(
      {
        create: (createInput) => repository.create(createInput),
        findBySlug: async (findSlug) => {
          try {
            return await repository.findBySlug(findSlug)
          } catch (findError) {
            console.error('Error finding artist during interactive fallback:', findError)
            return null
          }
        },
      },
      { displayName: rawName.trim(), slug },
      slug,
    )
  }

  function $reset() {
    artists.value = []
    isLoading.value = false
    initialized.value = false
    loadFailed.value = false
    activeArtistsRepository = null
    cacheArtistsRepository = null
    cacheDirty = false
    sessionGuard.reset()
  }

  return {
    artists,
    isLoading,
    initialized,
    loadFailed,
    initializeForCurrentSession,
    persistArtistsCacheSnapshot,
    addResolvedArtist,
    resolveOrCreateArtist,
    $reset,
  }
})
