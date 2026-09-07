import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import i18n from '../i18n'
import type { Artist } from '../types/artist'
import type { Favorite, Timestamp } from '../types/favorite'
import { getYoutubeVideoId, isSafeHttpUrl, isSoundCloudUrl, normalizeUrl } from '../utils/url'
import { timeFormatIsValid } from '../utils/favorite'
import { electArtistDisplayNames, normalizeArtistName } from '../utils/artist'
import type {
  FavoriteRecordInput,
  FavoritesRepository,
  RepositoryMode,
} from '../services/favoritesRepository'
import { FavoritesRepositoryError, selectRepositories } from '../services/favoritesRepository'
import { LocalFavoritesRepository } from '../services/localFavoritesRepository'
import type { ArtistRecordInput, ArtistsRepository } from '../services/artistsRepository'
import { useArtistsStore } from './artists'
import { useAuthStore } from './auth'
import { useFavoritesUiStore } from './favoritesUi'
import { FavoriteImportError, parseFavoritesImportFile } from '../services/favoriteImport'

interface InitializeFavoritesOptions {
  backendAvailable: boolean
  force?: boolean
}

interface FavoriteDraft {
  id?: string
  url: string
  title: string
  artists: string[]
  timestamps: Timestamp[]
  thumbnail?: string
}

const DEFAULT_THUMBNAIL = 'https://placehold.co/600x400/e2e8f0/adb5bd?text=Miniature'
const RATE_LIMIT_STATUS = 429
const MAX_CREATE_ATTEMPTS = 4
const INITIAL_RATE_LIMIT_DELAY_MS = 1000
const MAX_RATE_LIMIT_DELAY_MS = 8000

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function isRateLimitedError(error: unknown): boolean {
  if (!(error instanceof FavoritesRepositoryError)) return false
  const cause = error.cause
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    (cause as { status: unknown }).status === RATE_LIMIT_STATUS
  )
}

// Shared across a whole import: one item getting rate-limited slows the pace
// of every item still to come, instead of only retrying that one item.
class ImportRateLimiter {
  private minGapMs = 0
  private nextRequestAt = 0

  async pace() {
    const waitMs = this.nextRequestAt - Date.now()
    if (waitMs > 0) await wait(waitMs)
  }

  onRateLimited() {
    this.minGapMs =
      this.minGapMs === 0
        ? INITIAL_RATE_LIMIT_DELAY_MS
        : Math.min(this.minGapMs * 2, MAX_RATE_LIMIT_DELAY_MS)
    this.nextRequestAt = Date.now() + this.minGapMs
  }

  // A create clearing the limiter means its window has moved on: go back to
  // full speed instead of paying the escalated delay for the rest of the batch.
  onSuccess() {
    this.minGapMs = 0
    this.nextRequestAt = Date.now()
  }
}

async function createFavoriteWithRetry(
  repository: FavoritesRepository,
  input: FavoriteRecordInput,
  limiter: ImportRateLimiter,
  attempt = 1,
): Promise<Favorite> {
  await limiter.pace()
  try {
    const created = await repository.create(input)
    limiter.onSuccess()
    return created
  } catch (error) {
    if (attempt >= MAX_CREATE_ATTEMPTS || !isRateLimitedError(error)) throw error
    limiter.onRateLimited()
    return createFavoriteWithRetry(repository, input, limiter, attempt + 1)
  }
}

async function createArtistWithRetry(
  repository: ArtistsRepository,
  input: ArtistRecordInput,
  limiter: ImportRateLimiter,
  attempt = 1,
): Promise<Artist> {
  await limiter.pace()
  try {
    const created = await repository.create(input)
    limiter.onSuccess()
    return created
  } catch (error) {
    if (attempt >= MAX_CREATE_ATTEMPTS || !isRateLimitedError(error)) throw error
    limiter.onRateLimited()
    return createArtistWithRetry(repository, input, limiter, attempt + 1)
  }
}

// Resolves the whole import's artist-name population in one pass, before any
// favorite is created, so two rows crediting the same name (by R13's
// case/accent/whitespace-insensitive matching) never create two artists
// (KTD5). An existing artist always wins over the file's own election
// (AE17) -- the election only decides the spelling for a genuinely new
// artist. Artist creates share the import's rate limiter and retry path with
// favorite creates (KTD8). A create rejected by the unique index is treated
// as a find (KTD7). A slug that fails to resolve is simply absent from the
// returned map; the caller decides what that means for the rows crediting it
// (R18).
async function resolveImportArtistsBySlug(
  population: string[],
  artistsStore: ReturnType<typeof useArtistsStore>,
  artistsRepository: ArtistsRepository,
  limiter: ImportRateLimiter,
): Promise<Map<string, Artist>> {
  const elected = electArtistDisplayNames(population)
  const resolvedBySlug = new Map<string, Artist>()

  for (const [slug, electedDisplayName] of elected) {
    const existing = artistsStore.artists.find((artist) => artist.slug === slug)
    if (existing) {
      resolvedBySlug.set(slug, existing)
      continue
    }

    try {
      const created = await createArtistWithRetry(
        artistsRepository,
        { displayName: electedDisplayName, slug },
        limiter,
      )
      artistsStore.artists.push(created)
      resolvedBySlug.set(slug, created)
    } catch (error) {
      // The find-as-fallback lookup can itself fail (e.g. a genuine network
      // error, not just a clean "not found"). That must not abort the whole
      // import -- it just means this slug stays unresolved, so only the rows
      // crediting it are reported as failed (R18).
      let found: Artist | null = null
      try {
        found = await artistsRepository.findBySlug(slug)
      } catch (findError) {
        console.error('Error finding artist during import fallback:', findError)
      }

      if (!found) {
        console.error('Error creating artist during import:', error)
        continue
      }
      if (!artistsStore.artists.some((artist) => artist.id === found.id)) {
        artistsStore.artists.push(found)
      }
      resolvedBySlug.set(slug, found)
    }
  }

  await artistsStore.persistArtistsCacheSnapshot()
  return resolvedBySlug
}

// Maps one favorite's raw artist names to already-resolved artists (from
// resolveImportArtistsBySlug), deduping by id. A name empty once trimmed is
// dropped silently (mirrors AE8) and is NOT a resolution failure. A name
// whose slug has no entry in resolvedBySlug means its artist failed to
// create; the row is reported as failed so the caller can honor R18 (leave
// the favorite unimported rather than under-crediting it).
function resolveRowArtists(
  rawNames: string[],
  resolvedBySlug: Map<string, Artist>,
): { resolved: Artist[]; failed: boolean } {
  const resolved: Artist[] = []
  const seenIds = new Set<string>()
  let failed = false

  for (const rawName of rawNames) {
    const slug = normalizeArtistName(rawName)
    if (slug === null) continue

    const artist = resolvedBySlug.get(slug)
    if (!artist) {
      failed = true
      continue
    }
    if (seenIds.has(artist.id)) continue
    seenIds.add(artist.id)
    resolved.push(artist)
  }

  return { resolved, failed }
}

// Resolves each raw typed name to a canonical Artist (creating it if unknown,
// per R2/KTD6), deduping by artist id so two spellings of one name typed in
// the same save credit that artist only once (AE7).
async function resolveArtistCredits(
  rawNames: string[],
  artistsStore: ReturnType<typeof useArtistsStore>,
): Promise<Artist[]> {
  const resolved: Artist[] = []
  const seenIds = new Set<string>()

  for (const rawName of rawNames) {
    const artist = await artistsStore.resolveOrCreateArtist(rawName)
    if (!artist || seenIds.has(artist.id)) continue
    seenIds.add(artist.id)
    resolved.push(artist)
  }

  return resolved
}

// R12: the export keeps its pre-identity shape. artistIds is an internal
// relation id, meaningless on a different account or instance, so it is
// deliberately not written out; the denormalized `artists` names column
// (KTD12) already carries everything the export needs.
export function buildFavoritesExportPayload(
  favoritesToExport: Favorite[],
): Omit<Favorite, 'artistIds'>[] {
  return favoritesToExport.map((favorite) => ({
    id: favorite.id,
    url: favorite.url,
    title: favorite.title,
    artists: favorite.artists,
    type: favorite.type,
    thumbnail: favorite.thumbnail,
    timestamps: favorite.timestamps,
    created: favorite.created,
  }))
}

function buildImportResultMessage(added: number, skipped: number, failed: number): string {
  const messageParts = [
    added === 0 && skipped > 0
      ? i18n.global.t('import.finished_zero_added', { skipped })
      : i18n.global.t('import.added', { count: added }) +
        (skipped ? i18n.global.t('import.with_skipped', { skipped }) : '.'),
  ]
  if (failed) messageParts.push(i18n.global.t('import.with_failed', { failed }))
  return messageParts.join(' ')
}

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Favorite[]>([])
  const isLoading = ref(false)
  const repositoryMode = ref<RepositoryMode>('local')
  const initialized = ref(false)
  const importProgress = ref<{ processed: number; total: number | null } | null>(null)
  const degradedReadOnly = ref(false)
  const isReadOnly = computed(
    () => repositoryMode.value === 'google-cache' || degradedReadOnly.value,
  )

  let activeRepository: FavoritesRepository | null = null
  let cacheRepository: LocalFavoritesRepository | null = null
  let importArtistsRepository: ArtistsRepository | null = null
  let sessionKey = ''

  const authStore = useAuthStore()

  function getCurrentSessionKey() {
    return `${authStore.authMode ?? 'none'}:${authStore.userId ?? 'anonymous'}`
  }

  async function initializeForCurrentSession(options: InitializeFavoritesOptions) {
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
    degradedReadOnly.value = false

    const selection = selectRepositories({
      authMode: authStore.authMode,
      userId: authStore.userId,
      backendAvailable: options.backendAvailable,
    })
    activeRepository = selection.activeRepository
    cacheRepository = selection.cacheRepository
    importArtistsRepository = selection.activeArtistsRepository
    repositoryMode.value = selection.mode

    try {
      favorites.value = await activeRepository.list()
      await persistCacheSnapshot()
    } catch (error) {
      console.error('Error initializing favorites:', error)

      if (repositoryMode.value === 'google-cloud' && cacheRepository) {
        favorites.value = await cacheRepository.list()
        activeRepository = cacheRepository
        repositoryMode.value = 'google-cache'
      } else {
        favorites.value = []
      }
    } finally {
      isLoading.value = false
    }
  }

  async function persistCacheSnapshot() {
    if (!cacheRepository) return
    await cacheRepository.replaceAll(favorites.value)
  }

  function setDegradedReadOnly(value: boolean) {
    degradedReadOnly.value = value
  }

  function buildFavoriteRecordInput(
    draft: FavoriteDraft,
    currentFavorite: Favorite | undefined,
    resolvedArtists: Artist[],
  ): FavoriteRecordInput {
    const type: Favorite['type'] = isSoundCloudUrl(draft.url) ? 'soundcloud' : 'youtube'
    const normalizedThumbnail = draft.thumbnail?.trim() || ''
    const hasUrlChanged = currentFavorite ? currentFavorite.url !== draft.url : false
    const hasFreshThumbnail =
      normalizedThumbnail.length > 0 && normalizedThumbnail !== currentFavorite?.thumbnail

    let thumbnail = hasUrlChanged
      ? hasFreshThumbnail
        ? normalizedThumbnail
        : DEFAULT_THUMBNAIL
      : normalizedThumbnail || currentFavorite?.thumbnail || DEFAULT_THUMBNAIL

    if (type === 'youtube' && thumbnail === DEFAULT_THUMBNAIL) {
      const videoId = getYoutubeVideoId(draft.url)
      if (videoId) {
        thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }
    }

    return {
      url: draft.url,
      title: draft.title.trim(),
      artists: resolvedArtists.map((artist) => artist.displayName),
      artistIds: resolvedArtists.map((artist) => artist.id),
      type,
      thumbnail,
      timestamps: draft.timestamps,
    }
  }

  async function blockIfReadOnly(favoritesUiStore: ReturnType<typeof useFavoritesUiStore>) {
    if (!isReadOnly.value) return false
    await favoritesUiStore.showAlert(i18n.global.t('messages.offline_read_only'), 'alert')
    return true
  }

  function getImportErrorMessage(error: FavoriteImportError) {
    switch (error.code) {
      case 'invalid_array':
        return i18n.global.t('import.error_invalid_array')
      case 'invalid_structure':
        return i18n.global.t('import.error_invalid_structure')
      case 'invalid_json':
      default:
        return i18n.global.t('import.error_invalid_json')
    }
  }

  async function addOrUpdateFavorite(draft: FavoriteDraft) {
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    if (await blockIfReadOnly(favoritesUiStore)) return false

    const normalizedUrl = await normalizeUrl(draft.url.trim())
    const duplicateFavorite = favorites.value.find(
      (favorite) => favorite.url === normalizedUrl && favorite.id !== draft.id,
    )

    if (duplicateFavorite) {
      await favoritesUiStore.showAlert(i18n.global.t('messages.url_exists'), 'alert')
      return false
    }

    for (const timestamp of draft.timestamps) {
      if (!timeFormatIsValid(timestamp.time)) {
        await favoritesUiStore.showAlert(i18n.global.t('messages.invalid_time_format'), 'alert')
        return false
      }
    }

    const currentFavorite = draft.id
      ? favorites.value.find((favorite) => favorite.id === draft.id)
      : undefined

    let resolvedArtists: Artist[]
    try {
      resolvedArtists = await resolveArtistCredits(draft.artists, artistsStore)
    } catch (error) {
      console.error('Error resolving artist credits:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_saving'), 'alert')
      return false
    }

    const favoriteInput = buildFavoriteRecordInput(
      {
        ...draft,
        url: normalizedUrl,
      },
      currentFavorite,
      resolvedArtists,
    )

    try {
      if (!activeRepository) {
        throw new Error('Favorites repository has not been initialized.')
      }

      if (draft.id) {
        const updatedFavorite = await activeRepository.update(draft.id, favoriteInput)
        favorites.value = favorites.value.map((favorite) =>
          favorite.id === draft.id ? updatedFavorite : favorite,
        )
      } else {
        const createdFavorite = await activeRepository.create(favoriteInput)
        favorites.value.push(createdFavorite)
      }

      await persistCacheSnapshot()
      return true
    } catch (error) {
      console.error('Error adding/updating favorite:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_saving'), 'alert')
      return false
    }
  }

  async function deleteFavorite(id: string) {
    const favoritesUiStore = useFavoritesUiStore()

    if (await blockIfReadOnly(favoritesUiStore)) return

    const confirmed = await favoritesUiStore.showConfirm(
      i18n.global.t('messages.confirm_delete_favorite'),
    )
    if (!confirmed) return

    try {
      if (!activeRepository) {
        throw new Error('Favorites repository has not been initialized.')
      }

      await activeRepository.delete(id)
      favorites.value = favorites.value.filter((favorite) => favorite.id !== id)
      await persistCacheSnapshot()
    } catch (error) {
      console.error('Error deleting favorite:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_deleting'), 'alert')
    }
  }

  async function importFavorites(data: Favorite[]) {
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    if (await blockIfReadOnly(favoritesUiStore)) {
      return { added: 0, skipped: data.length, failed: 0 }
    }

    if (!importArtistsRepository) {
      throw new Error('Artists repository has not been initialized.')
    }

    const existingUrls = new Set(favorites.value.map((favorite) => favorite.url))
    const usesCloudRepository = repositoryMode.value === 'google-cloud'
    const rateLimiter = new ImportRateLimiter()
    let added = 0
    let skipped = 0
    let failed = 0

    importProgress.value = { processed: 0, total: data.length }

    try {
      // Population pass: gather every row's raw artist names that will
      // plausibly survive the skip checks below, so the whole file's
      // distinct artists are resolved once before any favorite is created
      // (KTD5, KTD8). A name from a row later re-skipped as an already-seen
      // duplicate here is harmless to have resolved -- the resulting artist
      // is simply unused by this import.
      const population: string[] = []
      for (const favorite of data) {
        const normalizedUrl = await normalizeUrl(favorite.url)
        if (!isSafeHttpUrl(normalizedUrl) || existingUrls.has(normalizedUrl)) continue
        population.push(...(favorite.artists || []))
      }

      const resolvedBySlug = await resolveImportArtistsBySlug(
        population,
        artistsStore,
        importArtistsRepository,
        rateLimiter,
      )

      for (const favorite of data) {
        const normalizedUrl = await normalizeUrl(favorite.url)

        if (!isSafeHttpUrl(normalizedUrl)) {
          skipped++
          importProgress.value.processed++
          continue
        }

        if (existingUrls.has(normalizedUrl)) {
          skipped++
          importProgress.value.processed++
          continue
        }

        const { resolved: rowArtists, failed: rowFailed } = resolveRowArtists(
          favorite.artists || [],
          resolvedBySlug,
        )

        if (rowFailed) {
          failed++
          importProgress.value.processed++
          continue
        }

        const artists = rowArtists.map((artist) => artist.displayName)
        const artistIds = rowArtists.map((artist) => artist.id)

        try {
          if (usesCloudRepository && activeRepository) {
            const createdFavorite = await createFavoriteWithRetry(
              activeRepository,
              {
                url: normalizedUrl,
                title: favorite.title,
                artists,
                artistIds,
                type: favorite.type,
                thumbnail: favorite.thumbnail || DEFAULT_THUMBNAIL,
                timestamps: favorite.timestamps || [],
                created: favorite.created,
              },
              rateLimiter,
            )
            favorites.value.push(createdFavorite)
          } else {
            favorites.value.push({
              ...favorite,
              url: normalizedUrl,
              artists,
              artistIds,
              created: favorite.created || new Date().toISOString(),
            })
          }
          existingUrls.add(normalizedUrl)
          added++
        } catch (error) {
          console.error('Error importing favorite:', error)
          failed++
        }
        importProgress.value.processed++
      }
    } finally {
      importProgress.value = null
    }

    await persistCacheSnapshot()

    if (added === 0 && skipped === 0 && failed === 0) {
      await favoritesUiStore.showAlert(i18n.global.t('import.none_or_invalid'), 'alert')
      return { added, skipped, failed }
    }

    await favoritesUiStore.showAlert(
      buildImportResultMessage(added, skipped, failed),
      failed ? 'alert' : 'info',
    )

    return { added, skipped, failed }
  }

  async function importFromFile(file: File) {
    const favoritesUiStore = useFavoritesUiStore()

    // Mark busy before the file is even parsed, so the import control stays
    // disabled for the whole operation instead of leaving a gap a second
    // file selection could slip through during the async read.
    importProgress.value = { processed: 0, total: null }

    try {
      const favoritesToImport = await parseFavoritesImportFile(file)
      return await importFavorites(favoritesToImport)
    } catch (error) {
      if (error instanceof FavoriteImportError) {
        await favoritesUiStore.showAlert(
          `${i18n.global.t('import.error_prefix')}${getImportErrorMessage(error)}`,
          'alert',
        )
        return null
      }

      throw error
    } finally {
      importProgress.value = null
    }
  }

  async function exportFavorites() {
    const favoritesUiStore = useFavoritesUiStore()
    if (favorites.value.length === 0) {
      await favoritesUiStore.showAlert(i18n.global.t('export.no_favorites'), 'alert')
      return
    }

    const jsonString = JSON.stringify(buildFavoritesExportPayload(favorites.value), null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'groovemark-backup.json'
    anchor.click()
    URL.revokeObjectURL(url)
    anchor.remove()
  }

  function $reset() {
    favorites.value = []
    isLoading.value = false
    repositoryMode.value = 'local'
    initialized.value = false
    importProgress.value = null
    degradedReadOnly.value = false
    activeRepository = null
    cacheRepository = null
    importArtistsRepository = null
    sessionKey = ''
  }

  return {
    favorites,
    isLoading,
    repositoryMode,
    initialized,
    importProgress,
    isReadOnly,
    initializeForCurrentSession,
    setDegradedReadOnly,
    addOrUpdateFavorite,
    deleteFavorite,
    importFavorites,
    importFromFile,
    exportFavorites,
    $reset,
  }
})
