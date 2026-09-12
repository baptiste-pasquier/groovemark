import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
    artistIds: ['artist-1'],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
  }
}

function createFavorites(count: number): Favorite[] {
  return Array.from({ length: count }, (_, i) => createFavorite(`fav-${i + 1}`))
}

// The stylesheet as shipped. The grid's column progression lives there, not in
// the template, so a characterization of the progression has to read it from
// the source of truth rather than restate it.
const TAILWIND_CSS = readFileSync(resolve(process.cwd(), 'src/assets/tailwind.css'), 'utf8')

// The `@apply` body of one component class. Resolved from the class the
// rendered container actually carries, so this pins the *progression* without
// pinning the class's name -- the shared grid class is named neutrally and is
// free to be renamed again without this test having to be rewritten (KTD8).
function layoutRuleFor(className: string): string {
  const rule = TAILWIND_CSS.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))
  expect(rule, `no component rule for .${className} in tailwind.css`).not.toBeNull()
  return rule![1]
}

function mountGrid() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })
  return mount(FavoritesGrid, {
    global: {
      plugins: [i18n],
      stubs: {
        FavoriteCard: {
          name: 'FavoriteCard',
          template: '<div class="favorite-card" />',
          props: ['favorite', 'readOnly'],
        },
      },
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

    favoritesUiStore.setFilter('artist-1')
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

  it('marks FavoriteCard read-only while the offline cache is read-only', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(2)
    favoritesStore.repositoryMode = 'google-cache'

    const wrapper = mountGrid()

    const cards = wrapper.findAllComponents({ name: 'FavoriteCard' })
    expect(cards).toHaveLength(2)
    cards.forEach((card) => expect(card.props('readOnly')).toBe(true))
  })

  it('does not mark FavoriteCard read-only in a normal mode', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(2)

    const wrapper = mountGrid()

    const cards = wrapper.findAllComponents({ name: 'FavoriteCard' })
    expect(cards).toHaveLength(2)
    cards.forEach((card) => expect(card.props('readOnly')).toBe(false))
  })

  it('shows empty state when no favorites exist', () => {
    const wrapper = mountGrid()

    expect(wrapper.findAll('.favorite-card')).toHaveLength(0)
    expect(wrapper.find('.text-gray-500').exists()).toBe(true)
  })

  // --- Characterization of the shared card grid (KTD8) ---------------------
  // These two pin what the mixes grid renders and how its columns progress,
  // independently of what the shared layout class is called, so renaming that
  // class cannot degrade the mixes grid unnoticed.

  it('renders the mixes cards inside one container carrying the shared column progression', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(3)

    const wrapper = mountGrid()
    const grid = wrapper.find('#favorites-grid')

    expect(grid.exists()).toBe(true)
    expect(grid.findAll('.favorite-card')).toHaveLength(3)

    // Exactly one class, and it is a semantic layout class rather than a pile
    // of utilities: the template must not carry the progression itself.
    expect(grid.classes()).toHaveLength(1)

    const rule = layoutRuleFor(grid.classes()[0])
    expect(rule).toContain('grid-cols-1')
    expect(rule).toContain('md:grid-cols-[repeat(2,var(--layout-card-width))]')
    expect(rule).toContain('layout-3col:grid-cols-[repeat(3,var(--layout-card-width))]')
    expect(rule).toContain('layout-4col:grid-cols-[repeat(4,var(--layout-card-width))]')
    expect(rule).toContain('gap-[var(--layout-grid-gap)]')
  })

  it('keeps the mixes grid markup identical apart from the layout class name', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = createFavorites(2)

    const wrapper = mountGrid()

    // The container's own class attribute is masked -- it is the one token the
    // rename is allowed to change. Everything else about the rendered grid is
    // pinned, so a rename that also moved markup would fail here.
    const markup = wrapper
      .find('#favorites-grid')
      .html()
      .replace(/class="[^"]*"/, 'class="[layout]"')

    expect(markup).toMatchInlineSnapshot(`
      "<div id="favorites-grid" class="[layout]">
        <div class="favorite-card"></div>
        <div class="favorite-card"></div>
      </div>"
    `)
  })
})
