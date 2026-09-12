import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '../i18n'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useEventsUiStore } from '../stores/eventsUi'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { MusicEvent } from '../types/event'
import type { Favorite } from '../types/favorite'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'

function storedEvent(id: string, name: string, dateAttended: string, venue: string): MusicEvent {
  return { id, name, dateAttended, venue, performances: [] }
}

// Three years of nights, seeded in an order that is neither the date order nor
// the id order, so an assertion on the rendered order is a real one (AE18).
const SEEDED_EVENTS: MusicEvent[] = [
  storedEvent('mid', 'Nuits Sonores', '2025-05-04', 'Les Subsistances'),
  storedEvent('old', 'Peacock Society', '2024-07-06', 'Parc Floral'),
  storedEvent('new', 'Dour Festival', '2026-07-15', 'Dour Grounds'),
]

function createFavorite(id: string, title: string): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    artists: ['Anetha'],
    artistIds: ['artist-1'],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

async function seedLocalEvents(events: MusicEvent[] = SEEDED_EVENTS) {
  localStorage.setItem('groovemark:events:local', JSON.stringify(events))

  const authStore = useAuthStore()
  const eventsStore = useEventsStore()
  authStore.continueInLocalMode()
  await eventsStore.initializeForCurrentSession(sessionInit(false))

  return eventsStore
}

describe('Events UI Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('exposes every event in the order the domain store returns when nothing is searched', async () => {
    const eventsStore = await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(
      eventsStore.events.map((event) => event.id),
    )
  })

  it('keeps only the events held at a venue when part of its name is searched (R27, AE18)', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('subsist')

    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['mid'])
  })

  it('searches the event name as well as the venue (R27)', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('dour')

    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new'])
  })

  it('ignores case and surrounding whitespace in the search term', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('  PARC floral ')

    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['old'])
  })

  it('restores the full date-ordered list when the search box is cleared (AE18)', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('subsist')
    expect(eventsUiStore.filteredEvents).toHaveLength(1)

    eventsUiStore.setSearch('')

    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
  })

  it('filters without reordering, so the date ordering stays underneath the filter (R11)', async () => {
    const eventsStore = await seedLocalEvents([
      ...SEEDED_EVENTS,
      storedEvent('also-dour', 'Dour Warm-up', '2025-07-14', 'Dour Grounds'),
    ])
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('dour')

    const expected = eventsStore.events
      .filter((event) => event.venue.includes('Dour') || event.name.includes('Dour'))
      .map((event) => event.id)
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(expected)
    expect(expected).toEqual(['new', 'also-dour'])
  })

  it('returns nothing rather than the whole list when no event matches', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('warehouse')

    expect(eventsUiStore.filteredEvents).toEqual([])
  })

  it('leaves the mixes search and the mixes artist filter untouched (R27, KTD7)', async () => {
    await seedLocalEvents()
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = [
      createFavorite('fav-1', 'Anetha | Techno DJ Set'),
      createFavorite('fav-2', 'Daft Punk | Alive'),
    ]
    const favoritesUiStore = useFavoritesUiStore()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('subsist')

    expect(favoritesUiStore.searchTerm).toBe('')
    expect(favoritesUiStore.currentFilter).toBe('all')
    expect(favoritesUiStore.filteredFavorites).toHaveLength(2)
  })

  it('is not narrowed by the mixes search box (R27, KTD7)', async () => {
    await seedLocalEvents()
    const favoritesUiStore = useFavoritesUiStore()
    const eventsUiStore = useEventsUiStore()

    favoritesUiStore.setSearch('Alive')

    expect(eventsUiStore.searchTerm).toBe('')
    expect(eventsUiStore.filteredEvents).toHaveLength(3)
  })

  it('clears its own search on reset', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('subsist')
    eventsUiStore.$reset()

    expect(eventsUiStore.searchTerm).toBe('')
    expect(eventsUiStore.filteredEvents).toHaveLength(3)
  })

  it('starts newest-first, matching the order the domain store returns', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    expect(eventsUiStore.sortOrder).toBe('newest')
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
  })

  it('reverses the list when the sort is toggled, and back when it is toggled again', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.toggleSort()

    expect(eventsUiStore.sortOrder).toBe('oldest')
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['old', 'mid', 'new'])

    eventsUiStore.toggleSort()

    expect(eventsUiStore.sortOrder).toBe('newest')
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
  })

  it('reverses what the search left, not the whole list', async () => {
    await seedLocalEvents([
      ...SEEDED_EVENTS,
      storedEvent('also-dour', 'Dour Warm-up', '2025-07-14', 'Dour Grounds'),
    ])
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.setSearch('dour')
    eventsUiStore.toggleSort()

    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['also-dour', 'new'])
  })

  it('never reorders the domain store, which stays the canonical date ordering (R11)', async () => {
    const eventsStore = await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.toggleSort()

    // Read the computed first: it is lazy, so without this the reversal branch
    // never runs and the assertion below cannot fail however the reversal is
    // implemented.
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['old', 'mid', 'new'])
    expect(eventsStore.events.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
  })

  it('restores the newest-first order on reset', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.toggleSort()
    eventsUiStore.$reset()

    expect(eventsUiStore.sortOrder).toBe('newest')
    expect(eventsUiStore.filteredEvents.map((event) => event.id)).toEqual(['new', 'mid', 'old'])
  })

  it('keeps the sort when only the search is cleared, as the route guard does on leave', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    eventsUiStore.toggleSort()
    eventsUiStore.setSearch('')

    expect(eventsUiStore.sortOrder).toBe('oldest')
  })
})
