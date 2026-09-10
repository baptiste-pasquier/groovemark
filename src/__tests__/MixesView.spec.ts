import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import AddFavoriteButton from '../components/favorites/AddFavoriteButton.vue'
import FavoriteSearchBar from '../components/favorites/FavoriteSearchBar.vue'
import MixesView from '../components/favorites/MixesView.vue'
import ArtistList from '../components/filters/ArtistList.vue'
import ArtistSidebar from '../components/filters/ArtistSidebar.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Favorite } from '../types/favorite'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

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

function createFavorite(id: string, title: string): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    artists: ['Anetha'],
    artistIds: ['artist-1'],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [{ time: '01:30', label: 'Warehouse lift', rated: false }],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

async function mountMixesView(): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(MixesView, {
    global: {
      plugins: [i18n, router],
      stubs: {
        FavoriteCard: {
          name: 'FavoriteCard',
          template: '<div class="favorite-card" @click="$emit(\'edit\')" />',
          props: ['favorite', 'readOnly'],
          emits: ['edit', 'delete'],
        },
      },
    },
  })

  return { wrapper, router }
}

describe('MixesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('keeps the grid, the search bar, the add control and the artist filter list', async () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = [createFavorite('fav-1', 'Anetha | Techno DJ Set')]

    const { wrapper } = await mountMixesView()

    expect(wrapper.find('#favorites-grid').exists()).toBe(true)
    expect(wrapper.findComponent(FavoriteSearchBar).exists()).toBe(true)
    expect(wrapper.findComponent(AddFavoriteButton).exists()).toBe(true)
    expect(wrapper.findComponent(ArtistList).exists()).toBe(true)
    expect(wrapper.find('#sort-btn').exists()).toBe(true)
  })

  it('keeps the search narrowing the grid', async () => {
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    favoritesStore.favorites = [
      createFavorite('fav-1', 'Anetha | Techno DJ Set'),
      createFavorite('fav-2', 'Daft Punk | Alive'),
    ]

    const { wrapper } = await mountMixesView()
    expect(wrapper.findAll('.favorite-card')).toHaveLength(2)

    favoritesUiStore.setSearch('Alive')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(1)
  })

  it('opens the add modal from the add control and closes it', async () => {
    const { wrapper } = await mountMixesView()

    expect(wrapper.text()).not.toContain('Add a favorite')

    await wrapper.findComponent(AddFavoriteButton).trigger('click')

    expect(wrapper.text()).toContain('Add a favorite')

    await wrapper.find('#cancel-btn').trigger('click')

    expect(wrapper.text()).not.toContain('Add a favorite')
  })

  it('opens the edit modal from a mix card while the grid is mounted inside a route', async () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = [createFavorite('fav-1', 'Anetha | Techno DJ Set')]

    const { wrapper } = await mountMixesView()

    await wrapper.find('.favorite-card').trigger('click')

    expect(wrapper.text()).toContain('Edit favorite')
    expect((wrapper.find('#title').element as HTMLInputElement).value).toBe(
      'Anetha | Techno DJ Set',
    )
  })

  it('opens the artist filter sidebar from the header filter control', async () => {
    const { wrapper } = await mountMixesView()

    expect(wrapper.findComponent(ArtistSidebar).props('open')).toBe(false)

    await wrapper.find('#filter-menu-btn').trigger('click')

    expect(wrapper.findComponent(ArtistSidebar).props('open')).toBe(true)
  })
})
