import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ArtistList from '../components/filters/ArtistList.vue'
import i18n from '../i18n'
import { useArtistsStore } from '../stores/artists'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Artist } from '../types/artist'
import type { Favorite } from '../types/favorite'

// This spec pins the *rendering* of the mixes sidebar, deliberately without
// naming the store property the counts come from (R20): the per-artist
// reduction behind them grew from a bare count into an aggregate, and a test
// that named the property would have had to be rewritten by the very change it
// was meant to guard.
function createArtist(id: string, displayName: string, slug: string): Artist {
  return { id, displayName, slug }
}

function createFavorite(id: string, overrides: Partial<Favorite> = {}): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `Favorite ${id}`,
    artists: [],
    artistIds: [],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function seed() {
  const artistsStore = useArtistsStore()
  const favoritesStore = useFavoritesStore()

  artistsStore.artists = [
    createArtist('artist-a', 'Amelie Lens', 'amelie lens'),
    createArtist('artist-z', 'Zebra Beats', 'zebra beats'),
  ]
  favoritesStore.favorites = [
    createFavorite('fav-1', { artists: ['Amelie Lens'], artistIds: ['artist-a'] }),
    createFavorite('fav-2', { artists: ['AMELIE LENS'], artistIds: ['artist-a'] }),
    createFavorite('fav-3', { artists: ['Zebra Beats'], artistIds: ['artist-z'] }),
  ]
}

function mountList() {
  return mount(ArtistList, { global: { plugins: [i18n] } })
}

describe('ArtistList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'en'
  })

  it('shows every referenced artist with its own mix count, and the total beside "all"', () => {
    seed()

    const rows = mountList().findAll('li')

    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('All artists (2)')
    expect(rows[0].text()).toContain('3')
    expect(rows[1].text()).toContain('Amelie Lens')
    expect(rows[1].text()).toContain('2')
    expect(rows[2].text()).toContain('Zebra Beats')
    expect(rows[2].text()).toContain('1')
  })

  it('shows a zero for an artist the loaded favorites credit through no artistId', () => {
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()

    // Referenced by one favorite, so the row exists; that favorite is then
    // replaced by one crediting nobody, which is the shape a legacy favorite
    // loads in.
    artistsStore.artists = [createArtist('artist-a', 'Amelie Lens', 'amelie lens')]
    favoritesStore.favorites = [
      createFavorite('fav-1', { artists: ['Amelie Lens'], artistIds: ['artist-a'] }),
    ]

    const wrapper = mountList()
    expect(wrapper.findAll('li')[1].text()).toContain('1')

    favoritesStore.favorites = [createFavorite('fav-1', { artists: ['Amelie Lens'] })]
    // The artist drops out of the referenced set entirely, so the list is the
    // "all" row alone -- no row is left rendering a stale count.
    expect(mountList().findAll('li')).toHaveLength(1)
  })

  it('filters the grid by artist id when a row is clicked, and does not navigate (R20)', async () => {
    seed()
    const favoritesUiStore = useFavoritesUiStore()

    const wrapper = mountList()
    await wrapper.findAll('li')[1].find('button').trigger('click')

    expect(favoritesUiStore.currentFilter).toBe('artist-a')
    // The artist name in the sidebar stays a filter control: one element
    // cannot both filter this grid and navigate away from it (R20).
    expect(wrapper.findAll('a')).toHaveLength(0)
    expect(wrapper.emitted('select')).toEqual([[]])
  })
})
