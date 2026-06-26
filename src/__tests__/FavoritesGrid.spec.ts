import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import FavoritesGrid from '../components/favorites/FavoritesGrid.vue'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Favorite } from '../types/favorite'

let observeMock: ReturnType<typeof vi.fn>
let disconnectMock: ReturnType<typeof vi.fn>
let intersectionCallback: IntersectionObserverCallback

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback
    observeMock = vi.fn()
    disconnectMock = vi.fn()
    this.observe = observeMock
    this.disconnect = disconnectMock
  }
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

function createFavorite(id: string): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `Favorite ${id}`,
    artists: ['Artist'],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

function createFavorites(count: number): Favorite[] {
  return Array.from({ length: count }, (_, i) => createFavorite(`fav-${i + 1}`))
}

function mountGrid() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
  return mount(FavoritesGrid, {
    global: {
      plugins: [i18n],
      stubs: { FavoriteCard: { template: '<div class="favorite-card" />', props: ['favorite'] } },
    },
  })
}

describe('FavoritesGrid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders only 20 cards when there are more favorites', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(25)

    const wrapper = mountGrid()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(20)
  })

  it('shows sentinel when there are more items to load', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(25)

    const wrapper = mountGrid()

    expect(wrapper.find('[class="h-1"]').exists()).toBe(true)
  })

  it('does not show sentinel when all items are visible', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(10)

    const wrapper = mountGrid()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(10)
    expect(wrapper.find('[class="h-1"]').exists()).toBe(false)
  })

  it('renders all items when count equals batch size', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(20)

    const wrapper = mountGrid()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(20)
    expect(wrapper.find('[class="h-1"]').exists()).toBe(false)
  })

  it('loads more items when IntersectionObserver fires', async () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(50)

    const wrapper = mountGrid()
    expect(wrapper.findAll('.favorite-card')).toHaveLength(20)

    intersectionCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(40)
  })

  it('does not overshoot when loading the last batch', async () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(25)

    const wrapper = mountGrid()

    intersectionCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(25)
    expect(wrapper.find('[class="h-1"]').exists()).toBe(false)
  })

  it('ignores IntersectionObserver when not intersecting', async () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(30)

    const wrapper = mountGrid()

    intersectionCallback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(20)
  })

  it('resets display count when search term changes', async () => {
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    favoritesStore.favorites = createFavorites(50)

    const wrapper = mountGrid()

    intersectionCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.favorite-card')).toHaveLength(40)

    favoritesUiStore.setSearch('Favorite')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(20)
  })

  it('resets display count when artist filter changes', async () => {
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    favoritesStore.favorites = createFavorites(50)

    const wrapper = mountGrid()

    intersectionCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.favorite-card')).toHaveLength(40)

    favoritesUiStore.setFilter('Artist')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(20)
  })

  it('calls IntersectionObserver observe on mount', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(25)

    mountGrid()

    expect(observeMock).toHaveBeenCalled()
  })

  it('disconnects IntersectionObserver on unmount', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(25)

    const wrapper = mountGrid()
    wrapper.unmount()

    expect(disconnectMock).toHaveBeenCalled()
  })

  it('shows empty state when no favorites exist', () => {
    const wrapper = mountGrid()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(0)
    expect(wrapper.find('.text-gray-500').exists()).toBe(true)
  })
})
