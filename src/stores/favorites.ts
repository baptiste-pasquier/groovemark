import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import i18n from '../i18n'
import type { Favorite, Timestamp } from '../types/favorite'
import { getYoutubeVideoId, normalizeUrl, fetchMetadata } from '../utils/url'
import { timeFormatIsValid } from '../utils/favorite'

interface ConfirmDialogState {
  message: string
  visible: boolean
  resolve?: (value: boolean) => void
}

interface AlertDialogState {
  message: string
  visible: boolean
  resolve?: () => void
}

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Favorite[]>(loadFavorites())
  const sortOrder = ref<'newest' | 'oldest'>('newest')
  const currentFilter = ref<string>('all')
  const searchTerm = ref('')

  const alertDialog = ref<AlertDialogState>({ message: '', visible: false })
  const confirmDialog = ref<ConfirmDialogState>({ message: '', visible: false })

  function loadFavorites(): Favorite[] {
    try {
      const raw = localStorage.getItem('favorites')
      if (!raw) return []
      return JSON.parse(raw) as Favorite[]
    } catch {
      return []
    }
  }

  function persist() {
    localStorage.setItem('favorites', JSON.stringify(favorites.value))
  }

  const allArtists = computed(() => {
    const set = new Set<string>()
    favorites.value.forEach((f) => (f.artists || []).forEach((a) => set.add(a)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })

  const filteredFavorites = computed(() => {
    const term = searchTerm.value.toLowerCase().trim()
    return favorites.value
      .filter((f) => {
        const artistPass =
          currentFilter.value === 'all' || (f.artists && f.artists.includes(currentFilter.value))
        const searchPass =
          !term ||
          f.title.toLowerCase().includes(term) ||
          f.artists.join(' ').toLowerCase().includes(term)
        return artistPass && searchPass
      })
      .sort((a, b) =>
        sortOrder.value === 'newest' ? Number(b.id) - Number(a.id) : Number(a.id) - Number(b.id),
      )
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

  function showAlert(message: string) {
    return new Promise<void>((resolve) => {
      alertDialog.value = { message, visible: true, resolve }
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

  async function addOrUpdateFavorite(
    partial: Omit<Favorite, 'id' | 'thumbnail' | 'timestamps' | 'type'> & {
      id?: string
      timestamps: Timestamp[]
    },
  ) {
    const id = partial.id || String(Date.now())
    const url = normalizeUrl(partial.url.trim())
    let title = partial.title.trim()
    const artists = partial.artists

    if (!partial.id && favorites.value.some((f) => f.url === url)) {
      await showAlert(i18n.global.t('messages.url_exists') as string)
      return
    }

    // Validate timestamps
    for (const ts of partial.timestamps) {
      if (!timeFormatIsValid(ts.time)) {
        await showAlert(i18n.global.t('messages.invalid_time_format') as string)
        return
      }
    }

    const type: Favorite['type'] = url.includes('soundcloud.com') ? 'soundcloud' : 'youtube'
    let thumbnail = 'https://placehold.co/600x400/e2e8f0/adb5bd?text=Miniature'

    const metadata = await fetchMetadata(url)
    if (metadata) {
      title = metadata.title || title
      if (artists.length === 0 && metadata.artist) artists.push(metadata.artist)
      if (metadata.thumbnail) thumbnail = metadata.thumbnail
    } else if (type === 'youtube') {
      const videoId = getYoutubeVideoId(url)
      if (videoId) thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    }

    const existingIndex = favorites.value.findIndex((f) => f.id === id)
    const newFavorite: Favorite = {
      id,
      url,
      title,
      artists: [...artists],
      type,
      thumbnail,
      timestamps: partial.timestamps,
    }

    if (existingIndex > -1) {
      favorites.value[existingIndex] = newFavorite
    } else {
      favorites.value.push(newFavorite)
    }
    persist()
  }

  async function deleteFavorite(id: string) {
    const confirmed = await showConfirm(i18n.global.t('messages.confirm_delete_favorite') as string)
    if (!confirmed) return
    favorites.value = favorites.value.filter((f) => f.id !== id)
    persist()
  }

  function importFavorites(data: Favorite[]) {
    const existingIds = new Set(favorites.value.map((f) => f.id))
    let added = 0
    let skipped = 0
    for (const fav of data) {
      if (existingIds.has(fav.id)) {
        skipped++
        continue
      }
      favorites.value.push(fav)
      existingIds.add(fav.id)
      added++
    }
    if (added === 0) {
      showAlert(
        (skipped > 0
          ? (i18n.global.t('import.finished_zero_added', { skipped }) as string)
          : (i18n.global.t('import.none_or_invalid') as string)) as string,
      )
      return { added, skipped }
    }
    persist()
    showAlert(
      (i18n.global.t('import.added', { count: added }) as string) +
        (skipped ? (i18n.global.t('import.with_skipped', { skipped }) as string) : '.'),
    )
    return { added, skipped }
  }

  function exportFavorites() {
    if (favorites.value.length === 0) {
      showAlert(i18n.global.t('export.no_favorites') as string)
      return
    }
    const jsonString = JSON.stringify(favorites.value, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mixstash-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    a.remove()
  }

  return {
    favorites,
    sortOrder,
    currentFilter,
    searchTerm,
    filteredFavorites,
    allArtists,
    alertDialog,
    confirmDialog,
    toggleSort,
    setSearch,
    setFilter,
    addOrUpdateFavorite,
    deleteFavorite,
    importFavorites,
    exportFavorites,
    closeAlert,
    respondConfirm,
    showAlert,
    showConfirm,
  }
})
