import { defineStore } from 'pinia'
import { computed, ref, type ComputedRef } from 'vue'
import i18n from '../i18n'
import type { Artist } from '../types/artist'
import type { MusicEvent } from '../types/event'
import type { Favorite, Timestamp } from '../types/favorite'
import { getYoutubeVideoId, isSafeHttpUrl, isSoundCloudUrl, normalizeUrl } from '../utils/url'
import { timeFormatIsValid } from '../utils/favorite'
import { createOrFindArtist, electArtistDisplayNames, normalizeArtistName } from '../utils/artist'
import type {
  FavoriteRecordInput,
  FavoritesRepository,
  RepositoryMode,
  SessionInitOptions,
} from '../services/favoritesRepository'
import { FavoritesRepositoryError } from '../services/favoritesRepository'
import { LocalFavoritesRepository } from '../services/localFavoritesRepository'
import type { ArtistsRepository } from '../services/artistsRepository'
import { createSessionGuard } from '../utils/sessionGuard'
import { useAppStore } from './app'
import { useArtistsStore } from './artists'
import { useAuthStore } from './auth'
import { useEventsStore } from './events'
import { useFavoritesUiStore } from './favoritesUi'
import type { BackupEvent, BackupFile } from '../services/favoriteImport'
import {
  BACKUP_FORMAT_VERSION,
  FavoriteImportError,
  parseBackupFile,
} from '../services/favoriteImport'

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

interface CreatableRepository<TInput, TRecord> {
  create(input: TInput): Promise<TRecord>
}

async function createRecordWithRetry<TInput, TRecord>(
  repository: CreatableRepository<TInput, TRecord>,
  input: TInput,
  limiter: ImportRateLimiter,
  attempt = 1,
): Promise<TRecord> {
  await limiter.pace()
  try {
    const created = await repository.create(input)
    limiter.onSuccess()
    return created
  } catch (error) {
    if (attempt >= MAX_CREATE_ATTEMPTS || !isRateLimitedError(error)) throw error
    limiter.onRateLimited()
    return createRecordWithRetry(repository, input, limiter, attempt + 1)
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
  const existingBySlug = new Map(artistsStore.artists.map((artist) => [artist.slug, artist]))

  const newEntries: { slug: string; displayName: string }[] = []
  for (const [slug, electedDisplayName] of elected) {
    const existing = existingBySlug.get(slug)
    if (existing) {
      resolvedBySlug.set(slug, existing)
    } else {
      newEntries.push({ slug, displayName: electedDisplayName })
    }
  }

  if (newEntries.length === 0) {
    return resolvedBySlug
  }

  if (artistsRepository.createMany) {
    // Local mode: one locked read-modify-write for the whole population
    // instead of one round trip per artist (still race-safe -- see
    // LocalArtistsRepository's write queue).
    try {
      const created = await artistsRepository.createMany(
        newEntries.map(({ slug, displayName }) => ({ displayName, slug })),
      )
      for (const artist of created) {
        artistsStore.addResolvedArtist(artist)
        resolvedBySlug.set(artist.slug, artist)
      }
    } catch (error) {
      console.error('Error batch-creating artists during import:', error)
    }
  } else {
    // Remote mode: no bulk-create endpoint is used here, so each artist
    // still goes through the import's shared retry/rate-limiter path
    // (KTD8). Race-recovery mechanics (KTD7) live in createOrFindArtist,
    // and a failure here (including the fallback find itself failing, e.g.
    // a genuine network error rather than a clean "not found") must not
    // abort the whole import -- it just means this slug stays unresolved,
    // so only the rows crediting it are reported as failed (R18).
    for (const { slug, displayName } of newEntries) {
      try {
        const resolved = await createOrFindArtist(
          {
            create: (createInput) => createRecordWithRetry(artistsRepository, createInput, limiter),
            findBySlug: async (findSlug) => {
              try {
                return await artistsRepository.findBySlug(findSlug)
              } catch (findError) {
                console.error('Error finding artist during import fallback:', findError)
                return null
              }
            },
          },
          { displayName, slug },
          slug,
        )
        artistsStore.addResolvedArtist(resolved)
        resolvedBySlug.set(slug, resolved)
      } catch (error) {
        console.error('Error creating artist during import:', error)
        continue
      }
    }
  }

  await artistsStore.persistArtistsCacheSnapshot()
  return resolvedBySlug
}

// Shared dedup step for a candidate list that may contain nulls (a name
// empty once trimmed, or one that failed to resolve): drop the nulls and
// keep only the first artist for each id.
function dedupeArtistsById(candidates: (Artist | null)[]): Artist[] {
  const seenIds = new Set<string>()
  const deduped: Artist[] = []
  for (const artist of candidates) {
    if (!artist || seenIds.has(artist.id)) continue
    seenIds.add(artist.id)
    deduped.push(artist)
  }
  return deduped
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
  let failed = false
  const candidates: (Artist | null)[] = []

  for (const rawName of rawNames) {
    const slug = normalizeArtistName(rawName)
    if (slug === null) continue

    const artist = resolvedBySlug.get(slug)
    if (!artist) {
      failed = true
      continue
    }
    candidates.push(artist)
  }

  return { resolved: dedupeArtistsById(candidates), failed }
}

// Resolves each raw typed name to a canonical Artist (creating it if unknown,
// per R2/KTD6), deduping by artist id so two spellings of one name typed in
// the same save credit that artist only once (AE7). Resolution stays
// sequential (not Promise.all) so two names that both create a genuinely new
// artist in the same save don't race each other into duplicate creates
// (KTD7 handles races across separate calls, not within one).
// Resolves (creating where needed) without registering anything into the
// artists store yet -- the caller only registers and persists the result
// once the favorite it's for has actually been saved (see addOrUpdateFavorite).
async function resolveArtistCredits(
  rawNames: string[],
  artistsStore: ReturnType<typeof useArtistsStore>,
): Promise<Artist[]> {
  const resolvedOrNull: (Artist | null)[] = []
  for (const rawName of rawNames) {
    resolvedOrNull.push(await artistsStore.resolveOrCreateArtist(rawName))
  }
  return dedupeArtistsById(resolvedOrNull)
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

// R24: an exported event credits its performers by display name and by nothing
// else. `artistId` is a relation id local to one account, so it is deliberately
// not written out -- the denormalized `artistName` already carries everything a
// restore onto another account needs, and the import resolves it there.
export function buildEventsExportPayload(eventsToExport: MusicEvent[]): BackupEvent[] {
  return eventsToExport.map((event) => ({
    id: event.id,
    name: event.name,
    dateAttended: event.dateAttended,
    venue: event.venue,
    performances: event.performances.map((performance) => ({
      artistName: performance.artistName,
      verdict: performance.verdict,
    })),
  }))
}

// The whole backup file as a pure projection over the two loaded domains (R22):
// an integer format version plus one top-level key each, so what the file is can
// be read off it rather than inferred from its shape.
export function buildBackupExportPayload(
  favoritesToExport: Favorite[],
  eventsToExport: MusicEvent[],
): BackupFile {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    mixes: buildFavoritesExportPayload(favoritesToExport),
    events: buildEventsExportPayload(eventsToExport),
  }
}

// KTD17: a performance's artist name resolves an artist like any other name,
// but votes on the winning spelling only when that artist has no mix-side name
// in the same file. Left unstated, several casual spellings across a line-up
// would outvote -- and so rename -- an artist whose mixes spell it properly;
// excluding performance names from the election entirely would leave a
// live-only artist with no spelling to be created under. An artist the target
// account already has keeps the display name it has either way (AE17): the
// election only ever decides the spelling for an artist the file creates.
export function buildImportArtistPopulation(
  mixArtistNames: string[],
  performanceArtistNames: string[],
): string[] {
  const mixSlugs = new Set<string>()
  for (const rawName of mixArtistNames) {
    const slug = normalizeArtistName(rawName)
    if (slug !== null) mixSlugs.add(slug)
  }

  const liveOnlyNames = performanceArtistNames.filter((rawName) => {
    const slug = normalizeArtistName(rawName)
    return slug !== null && !mixSlugs.has(slug)
  })

  return [...mixArtistNames, ...liveOnlyNames]
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
  // This domain's load-failure flag, one of the inputs the app store's single
  // read-only switch reads (KTD6). It is not a read-only flag of its own: the
  // decision is not made here.
  const loadFailed = ref(false)
  // A pass-through onto that one switch, kept so the mixes surfaces keep
  // reading their read-only state from the store they already talk to. It
  // holds no state of its own. Two details follow from the app store reading
  // this store back: `useAppStore()` is resolved lazily inside the body,
  // because resolving it eagerly at setup time would recurse, and the type is
  // annotated rather than inferred, because the cycle has to be pinned
  // somewhere.
  const isReadOnly: ComputedRef<boolean> = computed(() => useAppStore().isReadOnly)

  let activeRepository: FavoritesRepository | null = null
  let cacheRepository: LocalFavoritesRepository | null = null
  let importArtistsRepository: ArtistsRepository | null = null
  const sessionGuard = createSessionGuard()

  const authStore = useAuthStore()

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

    const selection = options.selection
    activeRepository = selection.activeRepository
    cacheRepository = selection.cacheRepository
    importArtistsRepository = selection.activeArtistsRepository
    repositoryMode.value = selection.mode

    try {
      favorites.value = await activeRepository.list()
      await persistCacheSnapshot()
    } catch (error) {
      console.error('Error initializing favorites:', error)
      loadFailed.value = true

      if (repositoryMode.value === 'google-cloud' && cacheRepository) {
        // The cache read is guarded too. Bootstrap awaits the three domain
        // loads together and only then decides anything, so a rejection here
        // skips that and lands in recoverFromSessionError -- which signs the
        // operator out. A failed cloud load whose cache is also unreadable
        // must cost the mixes list, never the session.
        try {
          favorites.value = await cacheRepository.list()
          activeRepository = cacheRepository
        } catch (cacheError) {
          console.error('Error loading favorites from cache fallback:', cacheError)
          favorites.value = []
        }
        // Running on the cache either way -- populated or empty -- so the mode
        // reported upward to the read-only switch says so.
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
      case 'unsupported_format':
        return i18n.global.t('import.error_unsupported_format', {
          version: BACKUP_FORMAT_VERSION,
        })
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

      // Only register/persist the artists this save actually resolved once
      // the favorite crediting them is confirmed saved -- registering them
      // earlier would show a newly-created artist as a suggestion even if
      // this save then failed, crediting nothing.
      resolvedArtists.forEach((artist) => artistsStore.addResolvedArtist(artist))
      await artistsStore.persistArtistsCacheSnapshot()

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

  // Restores one backup file (R22): the mixes half here, the events half through
  // the events store, both off one artist resolution pass. `eventRows` defaults
  // to empty so a caller restoring mixes alone is unchanged.
  async function importFavorites(data: Favorite[], eventRows: BackupEvent[] = []) {
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    if (await blockIfReadOnly(favoritesUiStore)) {
      return { added: 0, skipped: data.length + eventRows.length, failed: 0 }
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

    importProgress.value = { processed: 0, total: data.length + eventRows.length }

    try {
      // Population pass: gather every row's raw artist names that will
      // plausibly survive the skip checks below, so the whole file's
      // distinct artists are resolved once before any favorite is created
      // (KTD5, KTD8). A name from a row later re-skipped as an already-seen
      // duplicate here is harmless to have resolved -- the resulting artist
      // is simply unused by this import.
      const normalizedRows: { favorite: Favorite; normalizedUrl: string }[] = []
      const mixArtistNames: string[] = []
      for (const favorite of data) {
        const normalizedUrl = await normalizeUrl(favorite.url)
        normalizedRows.push({ favorite, normalizedUrl })
        if (!isSafeHttpUrl(normalizedUrl) || existingUrls.has(normalizedUrl)) continue
        mixArtistNames.push(...(favorite.artists || []))
      }

      // Every event row is imported, so every performance name joins the
      // population -- but only votes on the spelling under KTD17's rule.
      const performanceArtistNames = eventRows.flatMap((row) =>
        (row.performances || []).map((performance) => performance.artistName),
      )

      const resolvedBySlug = await resolveImportArtistsBySlug(
        buildImportArtistPopulation(mixArtistNames, performanceArtistNames),
        artistsStore,
        importArtistsRepository,
        rateLimiter,
      )

      for (const { favorite, normalizedUrl } of normalizedRows) {
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
            const createdFavorite = await createRecordWithRetry(
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

      // Events come after the artists are resolved and after the mixes, so a
      // performance credits the same artist record a mix in the same file does.
      if (eventRows.length > 0) {
        const eventsResult = await useEventsStore().importEvents(eventRows, {
          resolvedBySlug,
          createWithRetry: (repository, input) =>
            createRecordWithRetry(repository, input, rateLimiter),
          onRowProcessed: () => {
            if (importProgress.value) importProgress.value.processed++
          },
        })
        added += eventsResult.added
        failed += eventsResult.failed
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
      const backup = await parseBackupFile(file)
      return await importFavorites(backup.mixes, backup.events)
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

  // One export carries both domains (R22), so it is refused only when there is
  // nothing at all to write out.
  async function exportFavorites() {
    const favoritesUiStore = useFavoritesUiStore()
    const eventsToExport = useEventsStore().events
    if (favorites.value.length === 0 && eventsToExport.length === 0) {
      await favoritesUiStore.showAlert(i18n.global.t('export.no_favorites'), 'alert')
      return
    }

    // An export is the operator's escape hatch, so a degraded session must not
    // lose it -- but a half that failed to load reads as an empty array here,
    // and the file would assert that half is empty rather than unknown. The
    // difference only shows when the backup is restored, long after the fact,
    // so it is named now and the choice left to the operator.
    if (loadFailed.value || useEventsStore().loadFailed) {
      const confirmed = await favoritesUiStore.showConfirm(i18n.global.t('export.confirm_degraded'))
      if (!confirmed) return
    }

    const jsonString = JSON.stringify(
      buildBackupExportPayload(favorites.value, eventsToExport),
      null,
      2,
    )
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
    loadFailed.value = false
    activeRepository = null
    cacheRepository = null
    importArtistsRepository = null
    sessionGuard.reset()
  }

  return {
    favorites,
    isLoading,
    repositoryMode,
    initialized,
    importProgress,
    loadFailed,
    isReadOnly,
    initializeForCurrentSession,
    addOrUpdateFavorite,
    deleteFavorite,
    importFavorites,
    importFromFile,
    exportFavorites,
    $reset,
  }
})
