import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Artist } from '../types/artist'
import { useArtistsStore } from './artists'
import { useFavoritesStore } from './favorites'

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
    const seenIds = new Set<string>()
    const referenced: Artist[] = []
    favoritesStore.favorites.forEach((favorite) => {
      favorite.artistIds.forEach((artistId) => {
        if (seenIds.has(artistId)) return
        const artist = artistsStore.artists.find((candidate) => candidate.id === artistId)
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

  const favoritesCountByArtist = computed(() => {
    const counts: Record<string, number> = {}
    favoritesStore.favorites.forEach((favorite) => {
      favorite.artistIds.forEach((artistId) => {
        counts[artistId] = (counts[artistId] || 0) + 1
      })
    })
    return counts
  })

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
    favoritesCountByArtist,
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
