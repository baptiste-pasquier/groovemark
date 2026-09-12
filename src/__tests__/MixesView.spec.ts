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

function createFavorite(
  id: string,
  title: string,
  created: string = '2024-01-01T00:00:00.000Z',
): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    artists: ['Anetha'],
    artistIds: ['artist-1'],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [{ time: '01:30', label: 'Warehouse lift', rated: false }],
    created: new Date(created).toISOString(),
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
          template: '<div class="favorite-card" @click="$emit(\'edit\')">{{ favorite.id }}</div>',
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
  })

  it('puts the sort beside the search and toggles the mixes order', async () => {
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()
    favoritesStore.favorites = [
      createFavorite('fav-1', 'Anetha | Techno DJ Set', '2024-01-01T00:00:00.000Z'),
      createFavorite('fav-2', 'Daft Punk | Alive', '2024-06-01T00:00:00.000Z'),
    ]

    const { wrapper } = await mountMixesView()

    const sortButton = wrapper.get('#sort-btn')
    expect(sortButton.element.closest('.view-controls-search')).not.toBeNull()
    expect(favoritesUiStore.sortOrder).toBe('newest')

    const before = wrapper.findAll('.favorite-card').map((card) => card.text())
    expect(before).toEqual(['fav-2', 'fav-1'])

    await sortButton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(favoritesUiStore.sortOrder).toBe('oldest')
    const after = wrapper.findAll('.favorite-card').map((card) => card.text())
    expect(after).toEqual(['fav-1', 'fav-2'])
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

  it('opens the artist filter sidebar from the controls row', async () => {
    const { wrapper } = await mountMixesView()

    expect(wrapper.findComponent(ArtistSidebar).props('open')).toBe(false)

    const filterButton = wrapper.get('#filter-menu-btn')
    expect(filterButton.element.closest('.view-controls')).not.toBeNull()

    await filterButton.trigger('click')

    expect(wrapper.findComponent(ArtistSidebar).props('open')).toBe(true)
  })

  it('mounts the search and the create button once, above the sidebar and the grid', async () => {
    const { wrapper } = await mountMixesView()

    expect(wrapper.findAllComponents(FavoriteSearchBar)).toHaveLength(1)
    expect(wrapper.findAllComponents(AddFavoriteButton)).toHaveLength(1)

    const row = wrapper.get('.view-controls')
    expect(row.element.closest('.favorites-layout')).toBeNull()
    expect(wrapper.get('.mixes-body').element.contains(row.element)).toBe(true)
  })

  it('leaves the sidebar holding the artist list alone', async () => {
    const { wrapper } = await mountMixesView()
    const sidebar = wrapper.get('.favorites-sidebar-desktop')

    expect(sidebar.findComponent(ArtistList).exists()).toBe(true)
    expect(sidebar.findComponent(FavoriteSearchBar).exists()).toBe(false)
    expect(sidebar.findComponent(AddFavoriteButton).exists()).toBe(false)
  })
})
