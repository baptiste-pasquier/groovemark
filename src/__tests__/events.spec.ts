import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import { LocalEventsRepository } from '../services/localEventsRepository'
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
  "You're offline. Favorites are read-only until the connection is restored."

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
})
