import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import i18n from '../i18n'
import type { Artist } from '../types/artist'
import type {
  ArtistPerformance,
  ArtistPerformanceAggregate,
  ArtistPerformanceHistory,
  MusicEvent,
  Verdict,
} from '../types/event'
import type { BackupEvent, BackupPerformance } from '../services/favoriteImport'
import type { EventRecordInput, EventsRepository } from '../services/eventsRepository'
import type { RepositoryMode, SessionInitOptions } from '../services/favoritesRepository'
import { LocalEventsRepository } from '../services/localEventsRepository'
import { FavoritesRepositoryError } from '../services/favoritesRepository'
import { BATCH_MIGRATION_NAME } from '../services/pocketbaseEventsRepository'
import { normalizeArtistName } from '../utils/artist'
import {
  aggregateArtistPerformances,
  emptyArtistPerformanceAggregate,
  selectArtistPerformanceHistory,
} from '../utils/event'
import { createSessionGuard } from '../utils/sessionGuard'
import { useAppStore } from './app'
import { useArtistsStore } from './artists'
import { useAuthStore } from './auth'
import { useFavoritesUiStore } from './favoritesUi'

// One performance as a surface submits it: the artist is a *typed name*, not
// an id, because the operator types into an artist field and the store owns
// resolving that to an identity (R2). `id` names a row the event already has.
export interface EventPerformanceDraft {
  id?: string
  artistName: string
  verdict: Verdict | null
}

// A whole event as a surface submits it, line-up included, so the event saves
// or fails as a whole (R8, KTD3).
export interface EventDraft {
  id?: string
  name: string
  dateAttended: string
  venue: string
  performances: EventPerformanceDraft[]
}

// One save's line-up once every typed artist name has an identity: the record
// rows to send, plus the distinct artists they resolved to, which the caller
// registers into the artists store only after the event has saved.
interface ResolvedLineUp {
  resolved: Artist[]
  performances: EventRecordInput['performances']
}

// What the favorites store's import pass hands over when it restores the events
// half of a backup file (R22). The artist population of the whole file is
// already resolved there, in one pass, so two rows crediting the same name never
// create two artists (KTD5) -- this store only looks names up in the map.
// `createWithRetry` is that import's paced, retrying create: the events
// repository stays private to this store, so the caller supplies the policy and
// this store supplies the request, which is how an event restore obeys the same
// rate limit the mixes half does (KTD8).
export interface EventImportContext {
  resolvedBySlug: Map<string, Artist>
  createWithRetry: (
    repository: Pick<EventsRepository, 'create'>,
    input: EventRecordInput,
  ) => Promise<MusicEvent>
  onRowProcessed: () => void
}

// One imported line-up once every credited name has an identity on this
// account, or null when a name resolved to nothing. R8 forbids a partially
// credited event, so the caller leaves the whole row unimported rather than
// writing it with fewer performers. A name empty once trimmed credits nobody
// and is dropped, not a failure -- the rule the modal already follows (AE8).
// Two spellings of one name inside a line-up resolve to one artist but stay two
// performance rows, exactly as two typed rows would.
function resolveImportedLineUp(
  performances: BackupPerformance[],
  resolvedBySlug: Map<string, Artist>,
): ResolvedLineUp | null {
  const resolved = new Map<string, Artist>()
  const rows: EventRecordInput['performances'] = []

  for (const performance of performances) {
    const slug = normalizeArtistName(performance.artistName)
    if (slug === null) continue

    const artist = resolvedBySlug.get(slug)
    if (!artist) return null

    resolved.set(slug, artist)
    rows.push({
      artistId: artist.id,
      artistName: artist.displayName,
      verdict: performance.verdict,
    })
  }

  return { resolved: [...resolved.values()], performances: rows }
}

// Order two events newest-first (R11). Dates are compared as strings, which is
// correct for the bare `YYYY-MM-DD` day the repositories canonicalise to, and
// events sharing one date break the tie on id so the result is a total order
// that never depends on the position an event held in the repository's answer
// -- `list()` promises no order of its own.
function compareEventsNewestFirst(a: MusicEvent, b: MusicEvent): number {
  if (a.dateAttended !== b.dateAttended) return a.dateAttended < b.dateAttended ? 1 : -1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export const useEventsStore = defineStore('events', () => {
  // The list exactly as the repository handed it over, in no promised order.
  // Nothing outside this store reads it: `events` below is the ordered view,
  // so no surface can accidentally render an unordered list (R11).
  const loadedEvents = ref<MusicEvent[]>([])
  const isLoading = ref(false)
  const initialized = ref(false)
  const loadFailed = ref(false)
  // The mode this store is *actually* running in, which is not always the mode
  // the session started in: a failed cloud load falls back to the cache and
  // reports 'google-cache' from then on. The app store reads this to decide
  // whether the session is read-only (KTD6) -- reporting the mode honestly is
  // what keeps a stale half of the app from staying writable.
  const effectiveMode = ref<RepositoryMode>('local')

  // Repository handles live in the closure, not in refs: they are collaborators
  // rather than state, so nothing reactive re-runs when the active one is
  // swapped for the cache (KTD7). The same shape useArtistsStore uses.
  let activeEventsRepository: EventsRepository | null = null
  let cacheEventsRepository: LocalEventsRepository | null = null
  // Set whenever `loadedEvents.value` changes in a way the cache mirror does
  // not yet reflect, so the mirror can skip a write when nothing changed.
  let cacheDirty = false
  const sessionGuard = createSessionGuard()

  const authStore = useAuthStore()

  const events = computed<MusicEvent[]>(() =>
    [...loadedEvents.value].sort(compareEventsNewestFirst),
  )

  const eventsById = computed(() => new Map(loadedEvents.value.map((event) => [event.id, event])))

  // Every performance joined with its event's context, which is the shape every
  // per-artist surface reads (KTD12). Derived in memory rather than queried per
  // artist: the artists table sorts on aggregates over every artist at once.
  const artistPerformances = computed<ArtistPerformance[]>(() =>
    loadedEvents.value.flatMap((event) =>
      event.performances.map((performance) => ({
        performanceId: performance.id,
        eventId: event.id,
        eventName: event.name,
        dateAttended: event.dateAttended,
        venue: event.venue,
        artistId: performance.artistId,
        artistName: performance.artistName,
        verdict: performance.verdict,
      })),
    ),
  )

  // Keyed on artist id. An artist absent from this map is credited by no
  // performance at all -- which is exactly what R16 needs to tell apart from an
  // artist credited by a mix alone.
  const performancesByArtist = computed(() => {
    const grouped = new Map<string, ArtistPerformance[]>()
    for (const performance of artistPerformances.value) {
      const group = grouped.get(performance.artistId)
      if (group) {
        group.push(performance)
      } else {
        grouped.set(performance.artistId, [performance])
      }
    }
    return grouped
  })

  // The per-artist roll-up the artists table sorts on, keyed on artist id.
  // Read from utils/event.ts rather than derived here, so this and the artist
  // page can never disagree about an artist's leading verdict (KTD16).
  const artistPerformanceAggregates = computed(() =>
    aggregateArtistPerformances(artistPerformances.value),
  )

  // The artist page's live half (R14). Returns an empty history rather than
  // null for an artist never seen live, so the page has one shape to render.
  function performanceHistoryFor(artistId: string): ArtistPerformanceHistory {
    return selectArtistPerformanceHistory(performancesByArtist.value.get(artistId) ?? [])
  }

  // One artists-table row's aggregate. An artist no performance credits is
  // 'unseen', not 'unrated' (AE19).
  function performanceAggregateFor(artistId: string): ArtistPerformanceAggregate {
    return (
      artistPerformanceAggregates.value.get(artistId) ?? emptyArtistPerformanceAggregate(artistId)
    )
  }

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
    cacheDirty = false

    activeEventsRepository = options.selection.activeEventsRepository
    cacheEventsRepository = options.selection.cacheEventsRepository
    effectiveMode.value = options.selection.mode

    try {
      loadedEvents.value = await activeEventsRepository.list()
    } catch (error) {
      console.error('Error initializing events:', error)
      // Neither this failure nor the fallback's own may reject: bootstrap
      // awaits the three domain loads together and treats a rejection as a
      // broken session, which signs the operator out. An unreadable events
      // blob must cost the events tab, never the session -- so both are
      // swallowed here and reported upward as loadFailed instead, which is
      // what puts the session in read-only (KTD6).
      loadFailed.value = true
      if (options.selection.mode === 'google-cloud' && cacheEventsRepository) {
        try {
          loadedEvents.value = await cacheEventsRepository.list()
          activeEventsRepository = cacheEventsRepository
        } catch (cacheError) {
          console.error('Error loading events from cache fallback:', cacheError)
          loadedEvents.value = []
        }
        // Running on the cache either way -- populated or empty -- so the mode
        // reported upward says so.
        effectiveMode.value = 'google-cache'
      } else {
        loadedEvents.value = []
      }
    } finally {
      isLoading.value = false
    }

    // The boot mirror sits outside the load's try on purpose: it copies a list
    // the cloud already holds, so a device that refuses the write (quota,
    // private browsing) must not discard a healthy load, raise loadFailed and
    // turn the whole session read-only (KTD6) over a redundant copy. Only a
    // cloud load has anything to mirror -- `effectiveMode` already says
    // 'google-cache' when the load fell back, so a fallback never writes.
    if (effectiveMode.value === 'google-cloud') {
      cacheDirty = true
      await persistEventsCacheSnapshot()
    }
  }

  // Swallows a refused write and logs it: the event itself is already saved
  // through the active repository by the time this runs, so a device that
  // cannot cache must not make a successful save report failure -- that would
  // send the operator back to the modal to save the same night twice.
  async function persistEventsCacheSnapshot() {
    // Only a cloud session has a cache distinct from what it writes through:
    // in local and cache mode `selectRepositories` hands back the same
    // LocalEventsRepository on the same key, so mirroring here would rewrite
    // the whole key from memory right after the repository's own
    // read-modify-write -- undoing the write queue that exists so a concurrent
    // tab's night is never dropped, and, at boot, overwriting a blob the read
    // merely failed to parse.
    if (effectiveMode.value !== 'google-cloud') return
    if (!cacheEventsRepository || !cacheDirty) return
    try {
      await cacheEventsRepository.replaceAll(loadedEvents.value)
      cacheDirty = false
    } catch (error) {
      console.error('Error mirroring events into the cache:', error)
    }
  }

  async function blockIfReadOnly(favoritesUiStore: ReturnType<typeof useFavoritesUiStore>) {
    // The one read-only switch lives in the app store, which sees every
    // domain's load-failure flag and effective mode (KTD6). Resolved lazily
    // rather than at setup time: the app store's own setup resolves this
    // store, so resolving it back eagerly would recurse.
    if (!useAppStore().isReadOnly) return false
    await favoritesUiStore.showAlert(i18n.global.t('messages.offline_read_only'), 'alert')
    return true
  }

  // Resolves each performance's typed artist name to a canonical Artist,
  // creating one where the name is unknown (R2). Sequential, not Promise.all,
  // so two rows naming the same genuinely new artist cannot race each other
  // into duplicate creates -- and memoized on the normalized name for the same
  // reason within one save. Nothing is registered into the artists store here:
  // the caller registers only once the event crediting them has saved.
  async function resolvePerformanceArtists(
    drafts: EventPerformanceDraft[],
  ): Promise<ResolvedLineUp> {
    const artistsStore = useArtistsStore()
    const resolvedBySlug = new Map<string, Artist>()
    const performances: EventRecordInput['performances'] = []

    for (const draft of drafts) {
      const slug = normalizeArtistName(draft.artistName)
      // A performance credits exactly one artist (R2), so a row whose name is
      // empty once trimmed credits nobody and is dropped -- the same rule the
      // artist field already follows on a mix (AE8).
      if (slug === null) continue

      let artist = resolvedBySlug.get(slug)
      if (!artist) {
        const resolvedArtist = await artistsStore.resolveOrCreateArtist(draft.artistName)
        if (!resolvedArtist) continue
        artist = resolvedArtist
        resolvedBySlug.set(slug, artist)
      }

      performances.push({
        id: draft.id,
        artistId: artist.id,
        artistName: artist.displayName,
        verdict: draft.verdict,
      })
    }

    return { resolved: [...resolvedBySlug.values()], performances }
  }

  // What a failed save tells the operator. Two of the repository's failures are
  // not "try again": a line-up over the transaction's request bound never fits,
  // however many times it is sent, and a batch endpoint left disabled by an
  // unapplied migration refuses every event save on an instance whose reads and
  // lists work perfectly (KTD2). Both are actionable, and only their own
  // message says what the action is.
  function saveFailureMessage(error: unknown): string {
    if (error instanceof FavoritesRepositoryError) {
      if (error.code === 'batch_too_large') {
        return i18n.global.t('messages.error_line_up_too_long')
      }
      if (error.code === 'batch_unavailable') {
        return i18n.global.t('messages.error_batch_unavailable', {
          migration: BATCH_MIGRATION_NAME,
        })
      }
    }

    return i18n.global.t('messages.error_saving_event')
  }

  // Creates or edits one event, line-up included, as a single save (R8).
  // Returns whether it saved, so the surface knows whether to close.
  async function saveEvent(draft: EventDraft): Promise<boolean> {
    const favoritesUiStore = useFavoritesUiStore()
    const artistsStore = useArtistsStore()

    if (await blockIfReadOnly(favoritesUiStore)) return false

    let lineUp: ResolvedLineUp
    try {
      lineUp = await resolvePerformanceArtists(draft.performances)
    } catch (error) {
      console.error('Error resolving performance artists:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_saving_event'), 'alert')
      return false
    }

    const input: EventRecordInput = {
      name: draft.name.trim(),
      dateAttended: draft.dateAttended,
      venue: draft.venue.trim(),
      performances: lineUp.performances,
    }

    try {
      if (!activeEventsRepository) {
        throw new Error('Events repository has not been initialized.')
      }

      if (draft.id) {
        const updatedEvent = await activeEventsRepository.update(draft.id, input)
        loadedEvents.value = loadedEvents.value.map((event) =>
          event.id === draft.id ? updatedEvent : event,
        )
      } else {
        loadedEvents.value.push(await activeEventsRepository.create(input))
      }
      cacheDirty = true

      // Only register the artists this save resolved once the event crediting
      // them is confirmed saved: registering earlier would leave a
      // newly-created artist offered as a suggestion after a save that failed
      // and credited nothing.
      lineUp.resolved.forEach((artist) => artistsStore.addResolvedArtist(artist))
      await artistsStore.persistArtistsCacheSnapshot()

      await persistEventsCacheSnapshot()
      return true
    } catch (error) {
      console.error('Error saving event:', error)
      await favoritesUiStore.showAlert(saveFailureMessage(error), 'alert')
      return false
    }
  }

  // Restores the events half of a backup file (R22). Called only from the
  // favorites store's import, which has already refused the whole file if the
  // session is read-only -- one switch, checked once (KTD6) -- and which owns
  // the added/skipped/failed accounting this returns into.
  //
  // An event is one batch rather than one create, and it respects the request
  // bound the way the repository does: by refusing. The cloud repository's own
  // `batch_too_large` guard rejects an over-sized line-up, that rejection lands
  // here as a failed row, and the event is left unimported. Splitting it would
  // write one night across several transactions, which is the partial line-up
  // R8 forbids and the reason a transaction was chosen at all (KTD2).
  async function importEvents(
    rows: BackupEvent[],
    context: EventImportContext,
  ): Promise<{ added: number; failed: number }> {
    if (!activeEventsRepository) {
      throw new Error('Events repository has not been initialized.')
    }
    const repository = activeEventsRepository
    const artistsStore = useArtistsStore()

    let added = 0
    let failed = 0
    // Set once a row fails for a reason every remaining row would repeat.
    let batchUnavailableMessage: string | null = null

    for (const [index, row] of rows.entries()) {
      const lineUp = resolveImportedLineUp(row.performances ?? [], context.resolvedBySlug)

      if (!lineUp) {
        failed++
        context.onRowProcessed()
        continue
      }

      try {
        const createdEvent = await context.createWithRetry(repository, {
          name: row.name.trim(),
          dateAttended: row.dateAttended,
          venue: (row.venue ?? '').trim(),
          performances: lineUp.performances,
        })
        loadedEvents.value.push(createdEvent)
        cacheDirty = true

        // Registered only once the event crediting them is confirmed saved,
        // the same order a modal save follows.
        lineUp.resolved.forEach((artist) => artistsStore.addResolvedArtist(artist))
        added++
      } catch (error) {
        console.error('Error importing event:', error)
        failed++
        // A batch endpoint left disabled by an unapplied migration refuses
        // every event identically (KTD2), so the rows after this one would
        // only collect the same rejection. Keep the message that names the
        // migration: a bare failure count reads as a corrupt backup file, and
        // sends the operator to fix the wrong thing.
        if (error instanceof FavoritesRepositoryError && error.code === 'batch_unavailable') {
          batchUnavailableMessage = saveFailureMessage(error)
        }
      }

      context.onRowProcessed()

      if (batchUnavailableMessage) {
        // The rows never attempted still count as failed and still report as
        // processed, so the import's tally and its progress describe the whole
        // file rather than the part that ran.
        const abandoned = rows.length - index - 1
        failed += abandoned
        for (let remaining = 0; remaining < abandoned; remaining++) {
          context.onRowProcessed()
        }
        break
      }
    }

    if (added > 0) {
      await artistsStore.persistArtistsCacheSnapshot()
      await persistEventsCacheSnapshot()
    }

    // Said before the import's own summary, which counts rows but cannot name
    // a cause -- the two alerts queue, so the operator reads the fixable
    // deployment setting first.
    if (batchUnavailableMessage) {
      await useFavoritesUiStore().showAlert(batchUnavailableMessage, 'alert')
    }

    return { added, failed }
  }

  // Deletes one event, its line-up included (R26). The number of performances
  // the deletion carries off is *in* the confirmation rather than behind a
  // generic warning: they go with the event, and the operator has no way to
  // address them one at a time (AE16). Only the event row is deleted -- the
  // schema cascades the performances (KTD1) -- and no artist record is
  // touched, so a performer this night was the only credit for keeps their
  // identity while dropping out of the artists tab (AE5).
  async function deleteEvent(id: string) {
    const favoritesUiStore = useFavoritesUiStore()

    // The refusal comes before the confirmation, the order the mix delete
    // uses: a read-only session is never asked to confirm a write it cannot
    // make (KTD6).
    if (await blockIfReadOnly(favoritesUiStore)) return

    const performanceCount = eventsById.value.get(id)?.performances.length ?? 0
    const confirmed = await favoritesUiStore.showConfirm(
      i18n.global.t('messages.confirm_delete_event', { count: performanceCount }, performanceCount),
    )
    if (!confirmed) return

    try {
      if (!activeEventsRepository) {
        throw new Error('Events repository has not been initialized.')
      }

      await activeEventsRepository.delete(id)
      loadedEvents.value = loadedEvents.value.filter((event) => event.id !== id)
      cacheDirty = true
      await persistEventsCacheSnapshot()
    } catch (error) {
      console.error('Error deleting event:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_deleting_event'), 'alert')
    }
  }

  function $reset() {
    loadedEvents.value = []
    isLoading.value = false
    initialized.value = false
    loadFailed.value = false
    effectiveMode.value = 'local'
    activeEventsRepository = null
    cacheEventsRepository = null
    cacheDirty = false
    sessionGuard.reset()
  }

  return {
    events,
    eventsById,
    artistPerformances,
    performancesByArtist,
    artistPerformanceAggregates,
    isLoading,
    initialized,
    loadFailed,
    effectiveMode,
    performanceHistoryFor,
    performanceAggregateFor,
    initializeForCurrentSession,
    saveEvent,
    importEvents,
    deleteEvent,
    $reset,
  }
})
