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
import type { EventRecordInput, EventsRepository } from '../services/eventsRepository'
import type { RepositoryMode, SessionInitOptions } from '../services/favoritesRepository'
import { LocalEventsRepository } from '../services/localEventsRepository'
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
      // In cache mode the cache *is* the source, so mirroring would rewrite
      // the key it was just read from for nothing.
      if (options.selection.mode !== 'google-cache') {
        await cacheEventsRepository.replaceAll(loadedEvents.value)
      }
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
  }

  // Swallows a refused write and logs it: the event itself is already saved
  // through the active repository by the time this runs, so a device that
  // cannot cache must not make a successful save report failure -- that would
  // send the operator back to the modal to save the same night twice.
  async function persistEventsCacheSnapshot() {
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
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_saving'), 'alert')
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
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_saving'), 'alert')
      return false
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
    $reset,
  }
})
