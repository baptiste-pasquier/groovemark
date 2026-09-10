import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Artist } from '../types/artist'
import type { Favorite } from '../types/favorite'
import { useArtistsStore } from './artists'
import { useFavoritesStore } from './favorites'

// The three numbers R13 puts on an artist page, and R17 puts in every row of
// the artists tab: mixes kept, moments across those mixes, and starred moments
// among them. One aggregate rather than three reductions, because both surfaces
// read all three for the same artist and a second reduction is where they
// would start disagreeing (KTD16).
export interface ArtistMixAggregate {
  artistId: string
  mixCount: number
  momentCount: number
  starredMomentCount: number
}

// The aggregate for an artist no current favorite credits. A zero row, not an
// absent one: an artist page has to print three counts even when it has no
// mix to count (R15).
export function emptyArtistMixAggregate(artistId: string): ArtistMixAggregate {
  return { artistId, mixCount: 0, momentCount: 0, starredMomentCount: 0 }
}

interface ConfirmDialogState {
  message: string
  visible: boolean
  resolve?: (value: boolean) => void
}

interface AlertDialogState {
  message: string
  type: 'info' | 'alert'
  visible: boolean
  resolve?: () => void
}

export const useFavoritesUiStore = defineStore('favoritesUi', () => {
  const sortOrder = ref<'newest' | 'oldest'>('newest')
  const currentFilter = ref('all')
  const searchTerm = ref('')
  const alertDialog = ref<AlertDialogState>({ message: '', type: 'info', visible: false })
  const confirmDialog = ref<ConfirmDialogState>({ message: '', visible: false })

  const favoritesStore = useFavoritesStore()
  const artistsStore = useArtistsStore()

  // Referenced-artist subset for the filter list + counts (KTD14, R8): only
  // artists actually credited by artistIds on a current favorite. An artist
  // that no favorite references drops out here even though it stays
  // suggestible from the full loaded set below.
  const referencedArtists = computed(() => {
    const artistsById = new Map(artistsStore.artists.map((artist) => [artist.id, artist]))
    const seenIds = new Set<string>()
    const referenced: Artist[] = []
    favoritesStore.favorites.forEach((favorite) => {
      favorite.artistIds.forEach((artistId) => {
        if (seenIds.has(artistId)) return
        const artist = artistsById.get(artistId)
        if (!artist) return
        seenIds.add(artistId)
        referenced.push(artist)
      })
    })
    return referenced.sort((a, b) => a.displayName.localeCompare(b.displayName))
  })

  // Full loaded set for suggestions/resolution (KTD14): every artist in the
  // artists store, regardless of whether any favorite currently credits it.
  const allArtistNames = computed(() =>
    artistsStore.artists.map((artist) => artist.displayName).sort((a, b) => a.localeCompare(b)),
  )

  // The mixes crediting each artist, keyed on artist id, in the order the
  // repository handed them over -- the same order the mixes grid starts from
  // before its own sort. One grouping feeds both the artist page's list of
  // mixes and the aggregate below, so the list and the counts beside it can
  // never be built over different sets of favorites.
  const favoritesByArtist = computed(() => {
    const grouped = new Map<string, Favorite[]>()
    favoritesStore.favorites.forEach((favorite) => {
      favorite.artistIds.forEach((artistId) => {
        const group = grouped.get(artistId)
        if (group) {
          group.push(favorite)
        } else {
          grouped.set(artistId, [favorite])
        }
      })
    })
    return grouped
  })

  // Per-artist mix aggregates keyed on artist id (R13, R17). An artist absent
  // from this map is credited by no current favorite -- read it through
  // mixAggregateFor, which returns the zero row for that case.
  const mixAggregatesByArtist = computed(() => {
    const aggregates: Record<string, ArtistMixAggregate> = {}
    favoritesByArtist.value.forEach((favorites, artistId) => {
      aggregates[artistId] = favorites.reduce<ArtistMixAggregate>(
        (aggregate, favorite) => ({
          artistId,
          mixCount: aggregate.mixCount + 1,
          momentCount: aggregate.momentCount + favorite.timestamps.length,
          starredMomentCount:
            aggregate.starredMomentCount +
            favorite.timestamps.filter((timestamp) => timestamp.rated).length,
        }),
        emptyArtistMixAggregate(artistId),
      )
    })
    return aggregates
  })

  function mixesFor(artistId: string): Favorite[] {
    return favoritesByArtist.value.get(artistId) ?? []
  }

  function mixAggregateFor(artistId: string): ArtistMixAggregate {
    return mixAggregatesByArtist.value[artistId] ?? emptyArtistMixAggregate(artistId)
  }

  const filteredFavorites = computed(() => {
    const normalizedSearchTerm = searchTerm.value.toLowerCase().trim()

    return [...favoritesStore.favorites]
      .filter((favorite) => {
        const matchesArtist =
          currentFilter.value === 'all' || favorite.artistIds.includes(currentFilter.value)
        const matchesSearch =
          !normalizedSearchTerm ||
          favorite.title.toLowerCase().includes(normalizedSearchTerm) ||
          favorite.artists.join(' ').toLowerCase().includes(normalizedSearchTerm)
        return matchesArtist && matchesSearch
      })
      .sort((left, right) => {
        let leftCreated = left.created ? new Date(left.created).getTime() : 0
        let rightCreated = right.created ? new Date(right.created).getTime() : 0

        if (!leftCreated && !isNaN(Number(left.id))) leftCreated = Number(left.id)
        if (!rightCreated && !isNaN(Number(right.id))) rightCreated = Number(right.id)

        return sortOrder.value === 'newest'
          ? rightCreated - leftCreated
          : leftCreated - rightCreated
      })
  })

  function toggleSort() {
    sortOrder.value = sortOrder.value === 'newest' ? 'oldest' : 'newest'
  }

  function setSearch(term: string) {
    searchTerm.value = term
  }

  function setFilter(artist: string) {
    currentFilter.value = artist
  }

  function showAlert(message: string, type: 'info' | 'alert') {
    return new Promise<void>((resolve) => {
      alertDialog.value = { message, type, visible: true, resolve }
    })
  }

  function closeAlert() {
    alertDialog.value.visible = false
    alertDialog.value.resolve?.()
  }

  function showConfirm(message: string) {
    return new Promise<boolean>((resolve) => {
      confirmDialog.value = { message, visible: true, resolve }
    })
  }

  function respondConfirm(result: boolean) {
    confirmDialog.value.visible = false
    confirmDialog.value.resolve?.(result)
  }

  function $reset() {
    sortOrder.value = 'newest'
    currentFilter.value = 'all'
    searchTerm.value = ''
    alertDialog.value.resolve?.()
    confirmDialog.value.resolve?.(false)
    alertDialog.value = { message: '', type: 'info', visible: false }
    confirmDialog.value = { message: '', visible: false }
  }

  return {
    sortOrder,
    currentFilter,
    searchTerm,
    alertDialog,
    confirmDialog,
    referencedArtists,
    allArtistNames,
    favoritesByArtist,
    mixAggregatesByArtist,
    mixesFor,
    mixAggregateFor,
    filteredFavorites,
    toggleSort,
    setSearch,
    setFilter,
    showAlert,
    closeAlert,
    showConfirm,
    respondConfirm,
    $reset,
  }
})
