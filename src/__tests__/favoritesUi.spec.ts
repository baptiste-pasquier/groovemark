import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useArtistsStore } from '../stores/artists'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Artist } from '../types/artist'
import type { Favorite } from '../types/favorite'

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

describe('Favorites UI Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('only lists artists actually referenced by artistIds on current favorites, sorted by display name', () => {
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    const zArtist = createArtist('artist-z', 'Zebra Beats', 'zebra beats')
    const aArtist = createArtist('artist-a', 'Amelie Lens', 'amelie lens')
    const unreferencedArtist = createArtist(
      'artist-u',
      'Unreferenced Artist',
      'unreferenced artist',
    )
    artistsStore.artists = [zArtist, aArtist, unreferencedArtist]

    favoritesStore.favorites = [
      createFavorite('fav-1', { artists: ['Zebra Beats'], artistIds: ['artist-z'] }),
      createFavorite('fav-2', { artists: ['Amelie Lens'], artistIds: ['artist-a'] }),
    ]

    expect(favoritesUiStore.referencedArtists.map((artist) => artist.id)).toEqual([
      'artist-a',
      'artist-z',
    ])
  })

  it('drops an artist from the filter list once its last referencing favorite loses that credit, while it stays suggestible (AE5)', () => {
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    const artist = createArtist('artist-a', 'Amelie Lens', 'amelie lens')
    artistsStore.artists = [artist]

    const favorite = createFavorite('fav-1', { artists: ['Amelie Lens'], artistIds: ['artist-a'] })
    favoritesStore.favorites = [favorite]

    expect(favoritesUiStore.referencedArtists.map((a) => a.id)).toEqual(['artist-a'])
    expect(favoritesUiStore.allArtistNames).toEqual(['Amelie Lens'])

    // Remove the artist's last credit from the mix.
    favoritesStore.favorites = [{ ...favorite, artists: [], artistIds: [] }]

    expect(favoritesUiStore.referencedArtists).toEqual([])
    // Still suggestible: comes from the full artists-store set, not the referenced subset.
    expect(favoritesUiStore.allArtistNames).toEqual(['Amelie Lens'])
  })

  it('counts favorites by artist id', () => {
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    const artist = createArtist('artist-a', 'Amelie Lens', 'amelie lens')
    artistsStore.artists = [artist]

    favoritesStore.favorites = [
      createFavorite('fav-1', { artists: ['Amelie Lens'], artistIds: ['artist-a'] }),
      createFavorite('fav-2', { artists: ['AMELIE LENS'], artistIds: ['artist-a'] }),
    ]

    expect(favoritesUiStore.favoritesCountByArtist['artist-a']).toBe(2)
  })

  it('filters by artist id regardless of what spelling was typed when each favorite was saved', () => {
    const artistsStore = useArtistsStore()
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    const artist = createArtist('artist-a', 'Amelie Lens', 'amelie lens')
    const otherArtist = createArtist('artist-b', 'Other Artist', 'other artist')
    artistsStore.artists = [artist, otherArtist]

    const favoriteOne = createFavorite('fav-1', {
      artists: ['Amelie Lens'],
      artistIds: ['artist-a'],
    })
    const favoriteTwo = createFavorite('fav-2', { artists: ['AMELIE'], artistIds: ['artist-a'] })
    const otherFavorite = createFavorite('fav-3', {
      artists: ['Other Artist'],
      artistIds: ['artist-b'],
    })
    favoritesStore.favorites = [favoriteOne, favoriteTwo, otherFavorite]

    favoritesUiStore.setFilter('artist-a')

    expect(favoritesUiStore.filteredFavorites.map((f) => f.id).sort()).toEqual(['fav-1', 'fav-2'])
  })

  it('still matches by artist name substring when searching (regression check)', () => {
    const favoritesStore = useFavoritesStore()
    const favoritesUiStore = useFavoritesUiStore()

    favoritesStore.favorites = [
      createFavorite('fav-1', { title: 'Set One', artists: ['Amelie Lens'] }),
      createFavorite('fav-2', { title: 'Set Two', artists: ['Someone Else'] }),
    ]

    favoritesUiStore.setSearch('amelie')

    expect(favoritesUiStore.filteredFavorites.map((f) => f.id)).toEqual(['fav-1'])
  })
})
