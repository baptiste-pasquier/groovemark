import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useArtistsStore } from '../stores/artists'
import { useArtistsUiStore } from '../stores/artistsUi'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import type { EventPerformanceDraft } from '../stores/events'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import { FavoritesRepositoryError } from '../services/favoritesRepository'
import { LocalEventsRepository } from '../services/localEventsRepository'
import { BATCH_MAX_REQUESTS } from '../utils/event'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'
import {
  pocketbaseArtistsCollectionApi,
  pocketbaseBatchApi,
  pocketbaseCollectionApi,
  pocketbaseEventsCollectionApi,
  pocketbasePerformancesCollectionApi,
  resetPocketbaseMocks,
} from './mocks/pocketbase'
import type { MusicEvent, Performance, Verdict } from '../types/event'

const READ_ONLY_MESSAGE =
  "You're offline. Your changes are disabled until the connection is restored."

function createUser(id: string): RecordModel {
  return {
    id,
    collectionId: 'users',
    collectionName: 'users',
    name: `User ${id}`,
    email: `${id}@example.com`,
  }
}

function storedPerformance(
  id: string,
  eventId: string,
  artistId: string,
  artistName: string,
  verdict: Verdict | null = null,
): Performance {
  return { id, eventId, artistId, artistName, verdict }
}

function storedEvent(
  id: string,
  name: string,
  dateAttended: string,
  performances: Performance[] = [],
): MusicEvent {
  return { id, name, dateAttended, venue: `${name} venue`, performances }
}

// One event row exactly as PocketBase returns it: `dateAttended` is a date
// field, so the day travels back as a full timestamp.
function serverEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    name: 'Nuits Sonores',
    dateAttended: '2026-05-04 00:00:00.000Z',
    venue: 'Les Subsistances',
    owner: 'user-1',
    ...overrides,
  }
}

function serverPerformance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'performance-1',
    eventId: 'event-1',
    artistId: 'artist-1',
    artistName: 'Daft Punk',
    verdict: 'three-stars',
    owner: 'user-1',
    ...overrides,
  }
}

describe('Events Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  function signInAsGoogleUser() {
    const authStore = useAuthStore()
    authStore.authMode = 'google'
    authStore.isAuthenticated = true
    authStore.user = createUser('user-1')
    return authStore
  }

  it('loads cloud events and mirrors them into the user cache', async () => {
    signInAsGoogleUser()
    const eventsStore = useEventsStore()

    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([serverPerformance()])

    await eventsStore.initializeForCurrentSession(sessionInit(true))

    expect(eventsStore.effectiveMode).toBe('google-cloud')
    expect(eventsStore.loadFailed).toBe(false)
    expect(eventsStore.events).toEqual([
      {
        id: 'event-1',
        name: 'Nuits Sonores',
        dateAttended: '2026-05-04',
        venue: 'Les Subsistances',
        performances: [
          storedPerformance('performance-1', 'event-1', 'artist-1', 'Daft Punk', 'three-stars'),
        ],
      },
    ])
    expect(getLocalStorageState()['groovemark:events:google:user-1']).toContain('Nuits Sonores')
  })

  it('falls back to the cached events and flips the session to read-only when the cloud load fails', async () => {
    const cachedEvent = storedEvent('cached-1', 'Cached Night', '2026-01-01')
    localStorage.setItem('groovemark:events:google:user-1', JSON.stringify([cachedEvent]))

    signInAsGoogleUser()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseEventsCollectionApi.getFullList.mockRejectedValue(new Error('events unreachable'))

    await eventsStore.initializeForCurrentSession(sessionInit(true))

    expect(eventsStore.events).toEqual([cachedEvent])
    expect(eventsStore.loadFailed).toBe(true)
    expect(eventsStore.effectiveMode).toBe('google-cache')
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('loads from the cache in cache mode without overwriting it', async () => {
    const cachedEvent = storedEvent('cached-1', 'Cached Night', '2026-01-01')
    localStorage.setItem('groovemark:events:google:user-1', JSON.stringify([cachedEvent]))

    signInAsGoogleUser()
    const eventsStore = useEventsStore()

    await eventsStore.initializeForCurrentSession(sessionInit(false))

    expect(eventsStore.effectiveMode).toBe('google-cache')
    expect(eventsStore.events).toEqual([cachedEvent])
    // The cache is the source here, so the mirror must not rewrite it.
    expect(getLocalStorageState()['groovemark:events:google:user-1']).toBe(
      JSON.stringify([cachedEvent]),
    )
  })

  it('keeps a healthy cloud load writable when the device refuses the cache mirror', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([serverPerformance()])
    // What a full quota or a private window does to the mirror: the write is
    // refused -- and the repository throws rather than swallows -- while the
    // cloud list it was copying is perfectly fine.
    vi.spyOn(LocalEventsRepository.prototype, 'replaceAll').mockRejectedValue(
      new FavoritesRepositoryError('Could not save the event on this device.', 'write_failed'),
    )

    await appStore.handleAuthenticatedSession()

    expect(eventsStore.events.map((event) => event.name)).toEqual(['Nuits Sonores'])
    expect(eventsStore.loadFailed).toBe(false)
    expect(eventsStore.effectiveMode).toBe('google-cloud')
    // The cache only copies what the cloud already holds, so failing to write
    // it must not cost the operator every edit for the rest of the session.
    expect(favoritesStore.isReadOnly).toBe(false)
  })

  it('keeps the night a second tab saved while mirroring a local-mode save', async () => {
    const authStore = useAuthStore()
    authStore.continueInLocalMode()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()

    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    // A second tab on the same device saves its own night after this one
    // loaded, so the key now holds an event this tab has never seen.
    localStorage.setItem(
      'groovemark:events:local',
      JSON.stringify([storedEvent('other-tab-1', 'Other Tab Night', '2026-02-02')]),
    )

    const saved = await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-04',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
    })

    expect(saved).toBe(true)
    // In local mode the cache *is* the repository that just saved, on the same
    // key, so a mirror would rewrite it from memory and drop the other tab's
    // night -- exactly what the repository's write queue exists to prevent.
    const stored = JSON.parse(
      getLocalStorageState()['groovemark:events:local'] ?? '[]',
    ) as MusicEvent[]
    expect(stored.map((event) => event.name)).toEqual(['Other Tab Night', 'Nuits Sonores'])
  })

  it('signing out resets the store and leaves no event in memory', async () => {
    localStorage.setItem(
      'groovemark:events:google:user-1',
      JSON.stringify([storedEvent('cached-1', 'Cached Night', '2026-01-01')]),
    )

    signInAsGoogleUser()
    const appStore = useAppStore()
    const eventsStore = useEventsStore()

    await eventsStore.initializeForCurrentSession(sessionInit(false))
    expect(eventsStore.events).not.toEqual([])

    appStore.handleSignedOut()

    expect(eventsStore.events).toEqual([])
    expect(eventsStore.initialized).toBe(false)
    expect(eventsStore.loadFailed).toBe(false)
  })

  it('skips a second init for the same session and reloads on a forced one', async () => {
    localStorage.setItem(
      'groovemark:events:google:user-1',
      JSON.stringify([storedEvent('first-1', 'First Night', '2026-01-01')]),
    )

    signInAsGoogleUser()
    const eventsStore = useEventsStore()

    await eventsStore.initializeForCurrentSession(sessionInit(false))
    expect(eventsStore.events.map((event) => event.id)).toEqual(['first-1'])

    localStorage.setItem(
      'groovemark:events:google:user-1',
      JSON.stringify([storedEvent('second-1', 'Second Night', '2026-02-02')]),
    )

    await eventsStore.initializeForCurrentSession(sessionInit(false))
    expect(eventsStore.events.map((event) => event.id)).toEqual(['first-1'])

    await eventsStore.initializeForCurrentSession(sessionInit(false, { force: true }))
    expect(eventsStore.events.map((event) => event.id)).toEqual(['second-1'])
  })

  it('exposes events newest-first regardless of insertion order (AE15)', async () => {
    localStorage.setItem(
      'groovemark:events:local',
      JSON.stringify([
        storedEvent('middle', 'Middle Night', '2025-06-15'),
        storedEvent('oldest', 'Oldest Night', '2024-03-02'),
        storedEvent('newest', 'Newest Night', '2026-08-21'),
      ]),
    )

    const authStore = useAuthStore()
    const eventsStore = useEventsStore()

    authStore.continueInLocalMode()
    await eventsStore.initializeForCurrentSession(sessionInit(false))

    expect(eventsStore.events.map((event) => event.id)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('exposes the per-artist performance view keyed on artist id (KTD12)', async () => {
    localStorage.setItem(
      'groovemark:events:local',
      JSON.stringify([
        storedEvent('event-old', 'Old Night', '2024-03-02', [
          storedPerformance('p-old', 'event-old', 'artist-1', 'Daft Punk', 'one-star'),
        ]),
        storedEvent('event-new', 'New Night', '2026-08-21', [
          storedPerformance('p-new', 'event-new', 'artist-1', 'Daft Punk', null),
          storedPerformance('p-other', 'event-new', 'artist-2', 'Justice', 'three-stars'),
        ]),
      ]),
    )

    const authStore = useAuthStore()
    const eventsStore = useEventsStore()

    authStore.continueInLocalMode()
    await eventsStore.initializeForCurrentSession(sessionInit(false))

    expect(eventsStore.performancesByArtist.get('artist-1')).toHaveLength(2)
    expect(
      eventsStore.performancesByArtist.get('artist-1')?.map((performance) => performance.eventName),
    ).toEqual(expect.arrayContaining(['Old Night', 'New Night']))

    // The artist page leads with the most recent *rated* performance, while
    // the date last seen follows the most recent one rated or not (R14).
    const history = eventsStore.performanceHistoryFor('artist-1')
    expect(history.performances.map((performance) => performance.performanceId)).toEqual([
      'p-new',
      'p-old',
    ])
    expect(history.latestRated?.performanceId).toBe('p-old')

    const aggregate = eventsStore.performanceAggregateFor('artist-1')
    expect(aggregate).toMatchObject({
      artistId: 'artist-1',
      performanceCount: 2,
      verdictAvailability: 'rated',
      latestRatedVerdict: 'one-star',
      dateLastSeen: '2026-08-21',
    })

    // R16's other half: an artist nothing credits has a row shape but no
    // performance at all.
    expect(eventsStore.performanceAggregateFor('artist-unknown')).toMatchObject({
      performanceCount: 0,
      verdictAvailability: 'unseen',
    })
    expect(eventsStore.artistPerformances).toHaveLength(3)
  })

  it('creates the artist a performance names when it is unknown', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()

    authStore.continueInLocalMode()
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    const saved = await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-14',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
    })

    expect(saved).toBe(true)
    expect(artistsStore.artists.map((artist) => artist.displayName)).toEqual(['Daft Punk'])

    const [event] = eventsStore.events
    expect(event.performances).toHaveLength(1)
    expect(event.performances[0].artistName).toBe('Daft Punk')
    expect(event.performances[0].artistId).toBe(artistsStore.artists[0].id)
    expect(event.performances[0].verdict).toBe('three-stars')
    expect(getLocalStorageState()['groovemark:events:local']).toContain('Nuits Sonores')
  })

  it('does not offer a newly created artist as a suggestion when the event save then fails', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    vi.spyOn(init.selection.activeEventsRepository, 'create').mockRejectedValue(
      new Error('event write failed'),
    )

    const savePromise = eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-14',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
    })
    await flushPromises()
    favoritesUiStore.closeAlert()

    expect(await savePromise).toBe(false)
    expect(eventsStore.events).toEqual([])
    expect(artistsStore.artists).toEqual([])
  })

  it('edits an existing event through the repository', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()

    authStore.continueInLocalMode()
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-14',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: null }],
    })

    const [created] = eventsStore.events
    const saved = await eventsStore.saveEvent({
      id: created.id,
      name: 'Nuits Sonores 2026',
      dateAttended: '2026-05-15',
      venue: 'Halle Tony Garnier',
      performances: [
        { id: created.performances[0].id, artistName: 'Daft Punk', verdict: 'three-stars' },
      ],
    })

    expect(saved).toBe(true)
    expect(eventsStore.events).toHaveLength(1)
    expect(eventsStore.events[0]).toMatchObject({
      id: created.id,
      name: 'Nuits Sonores 2026',
      dateAttended: '2026-05-15',
      venue: 'Halle Tony Garnier',
    })
    expect(eventsStore.events[0].performances[0].id).toBe(created.performances[0].id)
    expect(eventsStore.events[0].performances[0].verdict).toBe('three-stars')
    // One artist, resolved once and reused rather than created twice.
    expect(artistsStore.artists).toHaveLength(1)
  })

  it('leaves the session signed in, the events tab empty and read-only when the events cache is unreadable', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const authStore = useAuthStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseEventsCollectionApi.getFullList.mockRejectedValue(new Error('events unreachable'))
    vi.spyOn(LocalEventsRepository.prototype, 'list').mockRejectedValue(
      new Error('events cache unreadable'),
    )

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(authStore.authMode).toBe('google')
    expect(eventsStore.events).toEqual([])
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('loads events alongside favorites and artists from the bootstrap', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft punk' },
    ] as never)
    pocketbaseCollectionApi.getFullList.mockResolvedValue([
      {
        id: 'cloud-1',
        url: 'https://youtube.com/watch?v=cloud',
        title: 'Cloud favorite',
        artists: ['Daft Punk'],
        artistIds: ['artist-1'],
        type: 'youtube',
        thumbnail: 'https://img.test/thumbnail.jpg',
        timestamps: [],
        created_at: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      },
    ] as never)
    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([serverPerformance()])

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(artistsStore.artists).toHaveLength(1)
    expect(favoritesStore.favorites).toHaveLength(1)
    expect(eventsStore.events).toHaveLength(1)
    expect(eventsStore.initialized).toBe(true)
    expect(favoritesStore.isReadOnly).toBe(false)
  })

  it('puts the session in read-only when the events load fails', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseEventsCollectionApi.getFullList.mockRejectedValue(new Error('events unreachable'))

    await appStore.handleAuthenticatedSession()

    expect(appStore.status).toBe('ready')
    expect(artistsStore.loadFailed).toBe(false)
    expect(eventsStore.loadFailed).toBe(true)
    expect(favoritesStore.isReadOnly).toBe(true)
  })

  it('refuses creating and editing an event while read-only', async () => {
    localStorage.setItem(
      'groovemark:events:google:user-1',
      JSON.stringify([storedEvent('cached-1', 'Cached Night', '2026-01-01')]),
    )

    signInAsGoogleUser()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()

    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    expect(eventsStore.effectiveMode).toBe('google-cache')

    const createPromise = eventsStore.saveEvent({
      name: 'Offline Night',
      dateAttended: '2026-05-14',
      venue: 'Nowhere',
      performances: [{ artistName: 'Daft Punk', verdict: null }],
    })
    await flushPromises()
    expect(favoritesUiStore.alertDialog.message).toBe(READ_ONLY_MESSAGE)
    favoritesUiStore.closeAlert()
    expect(await createPromise).toBe(false)

    const editPromise = eventsStore.saveEvent({
      id: 'cached-1',
      name: 'Renamed Offline',
      dateAttended: '2026-01-01',
      venue: 'Cached Night venue',
      performances: [],
    })
    await flushPromises()
    expect(favoritesUiStore.alertDialog.message).toBe(READ_ONLY_MESSAGE)
    favoritesUiStore.closeAlert()
    expect(await editPromise).toBe(false)

    expect(eventsStore.events.map((event) => event.name)).toEqual(['Cached Night'])
    expect(artistsStore.artists).toEqual([])
  })

  it('clears read-only for both mixes and events once a degraded session reloads healthy', async () => {
    signInAsGoogleUser()
    const appStore = useAppStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()

    pocketbaseArtistsCollectionApi.getFullList.mockRejectedValueOnce(
      new Error('artists unreachable'),
    )
    pocketbaseEventsCollectionApi.getFullList.mockRejectedValueOnce(new Error('events unreachable'))

    await appStore.handleAuthenticatedSession()
    expect(favoritesStore.isReadOnly).toBe(true)
    expect(eventsStore.loadFailed).toBe(true)

    await appStore.handleAuthenticatedSession()

    expect(favoritesStore.isReadOnly).toBe(false)
    expect(eventsStore.loadFailed).toBe(false)
    expect(eventsStore.effectiveMode).toBe('google-cloud')
    expect(favoritesStore.repositoryMode).toBe('google-cloud')
  })

  it('keeps a cloud save out of the batch endpoint when the session is healthy', async () => {
    signInAsGoogleUser()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft punk' },
    ] as never)

    const init = sessionInit(true)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    const saved = await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-14',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'two-stars' }],
    })

    expect(saved).toBe(true)
    // The artist was already known, so the save created no artist and sent
    // exactly one batch: the event plus its single performance row.
    expect(pocketbaseArtistsCollectionApi.create).not.toHaveBeenCalled()
    expect(pocketbaseBatchApi.requests.map((request) => request.collection)).toEqual([
      'events',
      'performances',
    ])
    expect(eventsStore.events).toHaveLength(1)
    expect(getLocalStorageState()['groovemark:events:google:user-1']).toContain('Nuits Sonores')
  })

  // ---- Deletion (R26) -------------------------------------------------------

  // Seeds a local-mode session holding one event whose line-up is the given
  // typed names, saved through the store so the artists it credits are real
  // resolved identities rather than hand-written rows.
  async function localSessionWithEvent(performances: EventPerformanceDraft[]) {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()

    authStore.continueInLocalMode()
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    const saved = await eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-04',
      venue: 'Les Subsistances',
      performances,
    })
    expect(saved).toBe(true)

    return { artistsStore, eventsStore, favoritesUiStore: useFavoritesUiStore() }
  }

  it('names the performances a deletion removes and leaves them all intact when dismissed (R26, AE16)', async () => {
    const { eventsStore, favoritesUiStore } = await localSessionWithEvent([
      { artistName: 'Daft Punk', verdict: 'three-stars' },
      { artistName: 'Justice', verdict: 'one-star' },
      { artistName: 'Anetha', verdict: null },
      { artistName: 'Trym', verdict: 'dislike' },
    ])
    const [event] = eventsStore.events
    expect(event.performances).toHaveLength(4)

    const deletePromise = eventsStore.deleteEvent(event.id)
    await flushPromises()

    // The count is in the message, not a generic warning: the performances go
    // with the event and the operator cannot address them one by one.
    expect(favoritesUiStore.confirmDialog.visible).toBe(true)
    expect(favoritesUiStore.confirmDialog.message).toContain('4 performances')

    favoritesUiStore.respondConfirm(false)
    await deletePromise

    expect(eventsStore.events).toHaveLength(1)
    expect(eventsStore.events[0].performances).toHaveLength(4)
    expect(eventsStore.artistPerformances).toHaveLength(4)
    expect(getLocalStorageState()['groovemark:events:local']).toContain('Nuits Sonores')
  })

  it('removes the event and its performances once confirmed, and no artist record (R26)', async () => {
    const { artistsStore, eventsStore, favoritesUiStore } = await localSessionWithEvent([
      { artistName: 'Daft Punk', verdict: 'three-stars' },
      { artistName: 'Justice', verdict: null },
    ])
    const [event] = eventsStore.events

    const deletePromise = eventsStore.deleteEvent(event.id)
    await flushPromises()
    favoritesUiStore.respondConfirm(true)
    await deletePromise

    expect(eventsStore.events).toEqual([])
    expect(eventsStore.artistPerformances).toEqual([])
    expect(getLocalStorageState()['groovemark:events:local']).toBe('[]')
    // Deleting a night removes the performances it held and nothing else: the
    // artists it credited keep their identity (R26).
    expect(artistsStore.artists.map((artist) => artist.displayName)).toEqual([
      'Daft Punk',
      'Justice',
    ])
    expect(getLocalStorageState()['groovemark:artists:local']).toContain('Daft Punk')
  })

  it('drops a performer credited only by the deleted event from the artists tab (AE5)', async () => {
    const { artistsStore, eventsStore, favoritesUiStore } = await localSessionWithEvent([
      { artistName: 'Trym', verdict: 'one-star' },
    ])
    const artistsUiStore = useArtistsUiStore()
    expect(artistsUiStore.sortedRows.map((row) => row.artist.displayName)).toEqual(['Trym'])

    const deletePromise = eventsStore.deleteEvent(eventsStore.events[0].id)
    await flushPromises()
    favoritesUiStore.respondConfirm(true)
    await deletePromise

    // Nothing credits Trym any more, so the row goes -- while the artist
    // record itself stays, because deleting an event removes no artist.
    expect(artistsUiStore.creditedArtists).toEqual([])
    expect(artistsUiStore.sortedRows).toEqual([])
    expect(artistsStore.artists).toHaveLength(1)
  })

  it('reads correctly at zero when the deleted event holds no performance (R26)', async () => {
    const { eventsStore, favoritesUiStore } = await localSessionWithEvent([])
    const [event] = eventsStore.events
    expect(event.performances).toEqual([])

    const deletePromise = eventsStore.deleteEvent(event.id)
    await flushPromises()

    expect(favoritesUiStore.confirmDialog.message).toContain('no performance')
    expect(favoritesUiStore.confirmDialog.message).not.toContain('0 performance')

    favoritesUiStore.respondConfirm(true)
    await deletePromise

    expect(eventsStore.events).toEqual([])
  })

  it('names a single performance in the singular, in the active locale (R26)', async () => {
    i18n.global.locale.value = 'fr'
    const { eventsStore, favoritesUiStore } = await localSessionWithEvent([
      { artistName: 'Trym', verdict: 'one-star' },
    ])

    const deletePromise = eventsStore.deleteEvent(eventsStore.events[0].id)
    await flushPromises()

    // Both shipped locales carry the message as three plural forms, so a
    // one-artist night never reads as "1 performances".
    expect(favoritesUiStore.confirmDialog.message).toBe(
      'Êtes-vous sûr de vouloir supprimer cet événement ? Sa suppression retire une performance.',
    )

    favoritesUiStore.respondConfirm(false)
    await deletePromise
    expect(eventsStore.events).toHaveLength(1)
  })

  it('refuses deleting an event while read-only, before any confirmation is shown (KTD6)', async () => {
    localStorage.setItem(
      'groovemark:events:google:user-1',
      JSON.stringify([
        storedEvent('cached-1', 'Cached Night', '2026-01-01', [
          storedPerformance('p-1', 'cached-1', 'artist-1', 'Daft Punk', 'two-stars'),
        ]),
      ]),
    )

    signInAsGoogleUser()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()

    await eventsStore.initializeForCurrentSession(sessionInit(false))
    expect(eventsStore.effectiveMode).toBe('google-cache')

    const deletePromise = eventsStore.deleteEvent('cached-1')
    await flushPromises()

    // The refusal comes first: a read-only session never gets as far as being
    // asked to confirm.
    expect(favoritesUiStore.alertDialog.message).toBe(READ_ONLY_MESSAGE)
    expect(favoritesUiStore.confirmDialog.visible).toBe(false)
    expect(favoritesUiStore.confirmDialog.message).toBe('')
    favoritesUiStore.closeAlert()
    await deletePromise

    expect(eventsStore.events.map((event) => event.id)).toEqual(['cached-1'])
    expect(eventsStore.artistPerformances).toHaveLength(1)
  })

  it('deletes only the event row in the cloud and lets the cascade take the performances (KTD1)', async () => {
    localStorage.setItem(
      'groovemark:events:google:user-1',
      JSON.stringify([storedEvent('event-1', 'Nuits Sonores', '2026-05-04')]),
    )

    signInAsGoogleUser()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()

    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([serverPerformance()])

    await eventsStore.initializeForCurrentSession(sessionInit(true))
    expect(eventsStore.events[0].performances).toHaveLength(1)

    const deletePromise = eventsStore.deleteEvent('event-1')
    await flushPromises()
    favoritesUiStore.respondConfirm(true)
    await deletePromise

    expect(pocketbaseEventsCollectionApi.delete).toHaveBeenCalledWith('event-1')
    // The database cascade removes the performances, so no row is deleted by
    // hand and no batch is sent.
    expect(pocketbasePerformancesCollectionApi.delete).not.toHaveBeenCalled()
    expect(pocketbaseBatchApi.requests).toEqual([])
    expect(eventsStore.events).toEqual([])
    expect(getLocalStorageState()['groovemark:events:google:user-1']).toBe('[]')
  })

  it('reports a failed deletion and keeps the event (R26)', async () => {
    signInAsGoogleUser()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()

    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([serverPerformance()])
    pocketbaseEventsCollectionApi.delete.mockRejectedValue(new Error('delete refused'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await eventsStore.initializeForCurrentSession(sessionInit(true))

    const deletePromise = eventsStore.deleteEvent('event-1')
    await flushPromises()
    favoritesUiStore.respondConfirm(true)
    await flushPromises()

    // The failure names the event, not the favorite: one message per
    // domain, so the alert never mislabels what could not be removed.
    expect(favoritesUiStore.alertDialog.message).toBe('Error deleting event. Please try again.')
    favoritesUiStore.closeAlert()
    await deletePromise

    expect(eventsStore.events.map((event) => event.id)).toEqual(['event-1'])
  })

  // ---- Restoring events from a backup file (R22, KTD2) ----------------------

  it('tells the operator a line-up is too long instead of asking them to try again (KTD2)', async () => {
    signInAsGoogleUser()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const lineUp = Array.from({ length: BATCH_MAX_REQUESTS }, (unused, index) => ({
      artistName: `Act ${index}`,
      verdict: null,
    }))
    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue(
      lineUp.map((performance, index) => ({
        id: `artist-${index}`,
        displayName: performance.artistName,
        slug: performance.artistName.toLowerCase(),
      })) as never,
    )

    const init = sessionInit(true)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    const savePromise = eventsStore.saveEvent({
      name: 'Too Long A Night',
      dateAttended: '2026-07-12',
      venue: 'Dour',
      performances: lineUp,
    })
    await flushPromises()

    // Retrying will never work, so "try again" is the wrong thing to say: the
    // operator has to split the night, and only this message tells them.
    expect(favoritesUiStore.alertDialog.message).toBe(
      'This line-up is too long to save as one event. Split the night into two events.',
    )
    favoritesUiStore.closeAlert()
    expect(await savePromise).toBe(false)
  })

  it('names the unapplied migration when the batch endpoint is disabled (KTD2)', async () => {
    signInAsGoogleUser()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesUiStore = useFavoritesUiStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft punk' },
    ] as never)
    // What a PocketBase instance answers when the endpoint is disabled: a 403,
    // which is indistinguishable from any other write failure unless the
    // repository's own code reaches the operator.
    pocketbaseBatchApi.send.mockRejectedValue({ status: 403 })

    const init = sessionInit(true)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)

    const savePromise = eventsStore.saveEvent({
      name: 'Nuits Sonores',
      dateAttended: '2026-05-14',
      venue: 'Les Subsistances',
      performances: [{ artistName: 'Daft Punk', verdict: 'two-stars' }],
    })
    await flushPromises()

    // Reading and listing events work on such an instance, so without the
    // migration named this reads as a transient failure that never clears.
    expect(favoritesUiStore.alertDialog.message).toContain('1789067402_enable_batch')
    favoritesUiStore.closeAlert()
    expect(await savePromise).toBe(false)
  })

  it('reports an over-sized line-up as a failed row and writes no partial event (KTD2)', async () => {
    signInAsGoogleUser()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // One artist for every credited name, already known, so the refusal is
    // about the batch bound and nothing else.
    const lineUp = Array.from({ length: BATCH_MAX_REQUESTS }, (unused, index) => ({
      artistName: `Act ${index}`,
      verdict: null,
    }))
    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue(
      lineUp.map((performance, index) => ({
        id: `artist-${index}`,
        displayName: performance.artistName,
        slug: performance.artistName.toLowerCase(),
      })) as never,
    )

    const init = sessionInit(true)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    await favoritesStore.initializeForCurrentSession(init)

    const importPromise = favoritesStore.importFavorites(
      [],
      [
        {
          name: 'Too Long A Night',
          dateAttended: '2026-07-12',
          venue: 'Dour',
          performances: lineUp,
        },
      ],
    )
    await flushPromises()
    favoritesUiStore.closeAlert()

    // 1 event + 50 performances is 51 requests, one over the bound the
    // repository refuses at -- refused, never split across transactions.
    expect(await importPromise).toEqual({ added: 0, skipped: 0, failed: 1 })
    expect(eventsStore.events).toEqual([])
    expect(pocketbaseBatchApi.send).not.toHaveBeenCalled()
  })

  it('names the disabled batch endpoint once and stops re-sending the rest of the file (KTD2)', async () => {
    signInAsGoogleUser()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    pocketbaseArtistsCollectionApi.getFullList.mockResolvedValue([
      { id: 'artist-1', displayName: 'Daft Punk', slug: 'daft punk' },
    ] as never)
    pocketbaseBatchApi.send.mockRejectedValue({ status: 403 })

    const init = sessionInit(true)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    await favoritesStore.initializeForCurrentSession(init)

    const importPromise = favoritesStore.importFavorites(
      [],
      [
        {
          name: 'First Night',
          dateAttended: '2026-05-04',
          venue: 'Les Subsistances',
          performances: [{ artistName: 'Daft Punk', verdict: null }],
        },
        {
          name: 'Second Night',
          dateAttended: '2026-05-05',
          venue: 'Le Sucre',
          performances: [{ artistName: 'Daft Punk', verdict: null }],
        },
      ],
    )
    await flushPromises()

    // A bare failure count reads as a corrupt backup file, and sends the
    // operator to fix the wrong thing: only this message names the migration.
    expect(favoritesUiStore.alertDialog.message).toContain('1789067402_enable_batch')
    favoritesUiStore.closeAlert()
    await flushPromises()

    // The import's own summary follows, and still counts the row that was
    // never attempted rather than losing it.
    expect(favoritesUiStore.alertDialog.message).toContain('2 failed to import')
    favoritesUiStore.closeAlert()

    expect(await importPromise).toEqual({ added: 0, skipped: 0, failed: 2 })
    expect(eventsStore.events).toEqual([])
    // Every remaining row would be refused identically, so only the first was
    // ever sent.
    expect(pocketbaseBatchApi.send).toHaveBeenCalledTimes(1)
  })

  it('restores an event through the events repository from the import path', async () => {
    const authStore = useAuthStore()
    const artistsStore = useArtistsStore()
    const eventsStore = useEventsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    authStore.continueInLocalMode()
    const init = sessionInit(false)
    await artistsStore.initializeForCurrentSession(init)
    await eventsStore.initializeForCurrentSession(init)
    await favoritesStore.initializeForCurrentSession(init)

    const importPromise = favoritesStore.importFavorites(
      [],
      [
        {
          name: 'Nuits Sonores',
          dateAttended: '2026-05-04',
          venue: 'Les Subsistances',
          performances: [{ artistName: 'Daft Punk', verdict: 'three-stars' }],
        },
      ],
    )
    await flushPromises()
    favoritesUiStore.closeAlert()

    expect(await importPromise).toEqual({ added: 1, skipped: 0, failed: 0 })
    expect(eventsStore.events[0]?.performances[0]?.verdict).toBe('three-stars')
    // The restore reaches storage through the same repository a save uses, so
    // a reload finds the night again.
    expect(getLocalStorageState()['groovemark:events:local']).toContain('Nuits Sonores')
  })
})
