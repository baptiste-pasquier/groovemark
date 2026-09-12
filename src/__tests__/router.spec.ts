import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import MixesView from '../components/favorites/MixesView.vue'
import i18n from '../i18n'
import { registerSearchReset, routes } from '../router'
import { useArtistsStore } from '../stores/artists'
import { useArtistsUiStore } from '../stores/artistsUi'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useEventsUiStore } from '../stores/eventsUi'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Artist } from '../types/artist'
import type { MusicEvent } from '../types/event'
import type { Favorite } from '../types/favorite'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// The same router the app builds: the table plus the guard that clears a
// destination's search when it is left.
function createTestRouter(): Router {
  const router = createRouter({ history: createMemoryHistory(), routes })
  registerSearchReset(router)
  return router
}

// The cards carry no part of the search rule, so they are stubbed down to a
// countable element and the assertions stay about how many rows come back.
const CARD_STUBS = {
  FavoriteCard: {
    name: 'FavoriteCard',
    template: '<div class="favorite-card" />',
    props: ['favorite', 'readOnly'],
  },
  EventCard: {
    name: 'EventCard',
    template: '<div class="event-card" />',
    props: ['event', 'readOnly'],
  },
}

function createFavorite(id: string, title: string, artistId: string, artist: string): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    artists: [artist],
    artistIds: [artistId],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

function storedEvent(id: string, name: string, dateAttended: string, venue: string): MusicEvent {
  return { id, name, dateAttended, venue, performances: [] }
}

const SEEDED_ARTISTS: Artist[] = [
  { id: 'artist-1', displayName: 'Anetha', slug: 'anetha' },
  { id: 'artist-2', displayName: 'Trym', slug: 'trym' },
]

const SEEDED_FAVORITES: Favorite[] = [
  createFavorite('fav-1', 'Anetha | Techno DJ Set', 'artist-1', 'Anetha'),
  createFavorite('fav-2', 'Trym | Alive', 'artist-2', 'Trym'),
]

const SEEDED_EVENTS: MusicEvent[] = [
  storedEvent('mid', 'Nuits Sonores', '2025-05-04', 'Les Subsistances'),
  storedEvent('old', 'Peacock Society', '2024-07-06', 'Parc Floral'),
  storedEvent('new', 'Dour Festival', '2026-07-15', 'Dour Grounds'),
]

// Everything the three destinations render, so a navigation away and back can
// be asked for a complete list on any of them.
async function seedEveryDestination() {
  localStorage.setItem('groovemark:events:local', JSON.stringify(SEEDED_EVENTS))
  useAuthStore().continueInLocalMode()
  await useEventsStore().initializeForCurrentSession(sessionInit(false))
  useArtistsStore().artists = SEEDED_ARTISTS
  useFavoritesStore().favorites = SEEDED_FAVORITES
}

async function mountAt(
  address: string,
): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = createTestRouter()
  await router.push(address)
  await router.isReady()

  const wrapper = mount(RouterView, { global: { plugins: [i18n, router], stubs: CARD_STUBS } })

  return { wrapper, router }
}

async function navigateTo(router: Router, address: string) {
  await router.push(address)
  await nextTick()
}

describe('router', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('keeps the destination switcher on screen at every declared address', async () => {
    const addresses = ['/', '/events', '/artists', '/artists/anetha']

    for (const address of addresses) {
      const router = createTestRouter()
      await router.push(address)
      await router.isReady()

      const wrapper = mount(RouterView, { global: { plugins: [i18n, router] } })

      expect(wrapper.findAll('[data-destination]').map((tab) => tab.text())).toEqual([
        'Mixes',
        'Events',
        'Artists',
      ])
      wrapper.unmount()
    }
  })

  it('resolves each top-level destination to the route the table names', async () => {
    const router = createTestRouter()
    const destinations = [
      ['/', 'mixes'],
      ['/events', 'events'],
      ['/artists', 'artists'],
    ] as const

    for (const [path, name] of destinations) {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe(name)
    }
  })

  it('renders the mixes view at the start address', async () => {
    const router = createTestRouter()

    await router.push('/')

    expect(router.currentRoute.value.matched[0]?.components?.default).toBe(MixesView)
  })

  it('resolves an artist address to the artist page with its slug parameter', async () => {
    const router = createTestRouter()

    await router.push('/artists/anetha')

    expect(router.currentRoute.value.name).toBe('artist')
    expect(router.currentRoute.value.params.slug).toBe('anetha')
  })

  it('decodes an artist slug carrying a slash or a space', async () => {
    const router = createTestRouter()

    await router.push('/artists/AC%2FDC')
    expect(router.currentRoute.value.name).toBe('artist')
    expect(router.currentRoute.value.params.slug).toBe('AC/DC')

    await router.push('/artists/daft%20punk')
    expect(router.currentRoute.value.name).toBe('artist')
    expect(router.currentRoute.value.params.slug).toBe('daft punk')
  })

  it('percent-encodes a slug when an artist address is built from the named route', () => {
    const router = createTestRouter()

    expect(router.resolve({ name: 'artist', params: { slug: 'AC/DC' } }).href).toBe(
      '/artists/AC%2FDC',
    )
    expect(router.resolve({ name: 'artist', params: { slug: 'daft punk' } }).href).toBe(
      '/artists/daft%20punk',
    )
  })

  it('sends an unrecognized address to the mixes destination', async () => {
    const router = createTestRouter()

    await router.push('/not/a/destination')

    expect(router.currentRoute.value.name).toBe('mixes')
    expect(router.currentRoute.value.matched[0]?.components?.default).toBe(MixesView)
  })

  // The search box is uncontrolled, so a term outliving its view would come
  // back as a filtered list behind an empty box. Each destination is asked for
  // both halves: the stored term, and the list it renders.
  describe('clears a destination search when that destination is left', () => {
    it('clears the mixes search', async () => {
      await seedEveryDestination()
      const favoritesUiStore = useFavoritesUiStore()

      const { wrapper, router } = await mountAt('/')
      favoritesUiStore.setSearch('Alive')
      await nextTick()
      expect(wrapper.findAll('.favorite-card')).toHaveLength(1)

      await navigateTo(router, '/events')
      await navigateTo(router, '/')

      expect(favoritesUiStore.searchTerm).toBe('')
      expect(wrapper.findAll('.favorite-card')).toHaveLength(2)
    })

    it('clears the events search', async () => {
      await seedEveryDestination()
      const eventsUiStore = useEventsUiStore()

      const { wrapper, router } = await mountAt('/events')
      eventsUiStore.setSearch('dour')
      await nextTick()
      expect(wrapper.findAll('.event-card')).toHaveLength(1)

      await navigateTo(router, '/')
      await navigateTo(router, '/events')

      expect(eventsUiStore.searchTerm).toBe('')
      expect(wrapper.findAll('.event-card')).toHaveLength(3)
    })

    it('clears the artists search', async () => {
      await seedEveryDestination()
      const artistsUiStore = useArtistsUiStore()

      const { wrapper, router } = await mountAt('/artists')
      artistsUiStore.setSearch('anetha')
      await nextTick()
      expect(wrapper.findAll('.artists-row')).toHaveLength(1)

      await navigateTo(router, '/events')
      await navigateTo(router, '/artists')

      expect(artistsUiStore.searchTerm).toBe('')
      expect(wrapper.findAll('.artists-row')).toHaveLength(2)
    })

    it('clears the artists search when an artist page is opened from a row', async () => {
      await seedEveryDestination()
      const artistsUiStore = useArtistsUiStore()

      const { router } = await mountAt('/artists')
      artistsUiStore.setSearch('anetha')

      await navigateTo(router, '/artists/anetha')

      expect(artistsUiStore.searchTerm).toBe('')
    })

    // The decision is about the search alone: the sort is legible in the
    // table's own header, so it cannot drift out of step the way the box can.
    it('keeps the artists table sort across a navigation', async () => {
      await seedEveryDestination()
      const artistsUiStore = useArtistsUiStore()

      const { router } = await mountAt('/artists')
      artistsUiStore.setSort('mixes')

      await navigateTo(router, '/events')
      await navigateTo(router, '/artists')

      expect(artistsUiStore.sortColumn).toBe('mixes')
      expect(artistsUiStore.sortDirection).toBe('desc')
    })

    // Leaving one destination clears its own box and no other's.
    it('leaves the other destinations searches untouched', async () => {
      await seedEveryDestination()
      const favoritesUiStore = useFavoritesUiStore()
      const eventsUiStore = useEventsUiStore()
      const artistsUiStore = useArtistsUiStore()

      const { router } = await mountAt('/events')
      favoritesUiStore.setSearch('Alive')
      eventsUiStore.setSearch('dour')
      artistsUiStore.setSearch('anetha')

      await navigateTo(router, '/artists')

      expect(eventsUiStore.searchTerm).toBe('')
      expect(favoritesUiStore.searchTerm).toBe('Alive')
      expect(artistsUiStore.searchTerm).toBe('anetha')
    })

    it('keeps the mixes artist filter across a navigation', async () => {
      await seedEveryDestination()
      const favoritesUiStore = useFavoritesUiStore()

      const { router } = await mountAt('/')
      favoritesUiStore.setFilter('Anetha')
      favoritesUiStore.setSearch('Alive')

      await navigateTo(router, '/events')
      await navigateTo(router, '/')

      expect(favoritesUiStore.searchTerm).toBe('')
      expect(favoritesUiStore.currentFilter).toBe('Anetha')
    })
  })
})
