import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import i18n from '../i18n'
import type { Favorite, Timestamp } from '../types/favorite'
import { getYoutubeVideoId, normalizeUrl, fetchMetadata } from '../utils/url'
import { timeFormatIsValid } from '../utils/favorite'
import { favoritesService } from '../services/favorites'

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
  const favorites = ref<Favorite[]>([])
  const sortOrder = ref<'newest' | 'oldest'>('newest')
  const currentFilter = ref<string>('all')
  const searchTerm = ref('')
  const isLoading = ref(false)
  const usePocketbase = ref(true)
  const initialized = ref(false)

  const alertDialog = ref<AlertDialogState>({ message: '', visible: false })
  const confirmDialog = ref<ConfirmDialogState>({ message: '', visible: false })

  async function initializeFavorites() {
    if (initialized.value) return
    initialized.value = true
    isLoading.value = true
    try {
      // Try to load from Pocketbase first
      const pbAvailable = await favoritesService.isAvailable()
      if (pbAvailable) {
        const pbFavorites = await favoritesService.getAll()
        favorites.value = pbFavorites
        usePocketbase.value = true
        // Sync to localStorage as backup
        persistToLocalStorage()
      } else {
        // Fallback to localStorage if Pocketbase is not available
        usePocketbase.value = false
        favorites.value = loadFromLocalStorage()
      }
    } catch (error) {
      console.error('Error initializing favorites:', error)
      // Fallback to localStorage on error
      usePocketbase.value = false
      favorites.value = loadFromLocalStorage()
    } finally {
      isLoading.value = false
    }
  }

  function loadFromLocalStorage(): Favorite[] {
    try {
      const raw = localStorage.getItem('favorites')
      if (!raw) return []
      return JSON.parse(raw) as Favorite[]
    } catch {
      return []
    }
  }

  function persistToLocalStorage() {
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites.value))
    } catch (error) {
      console.error('Error persisting to localStorage:', error)
    }
  }

  async function persist() {
    if (usePocketbase.value) {
      // Pocketbase persistence is handled per operation (create/update/delete)
      // Just sync to localStorage as backup
      persistToLocalStorage()
    } else {
      // Fallback to localStorage only
      persistToLocalStorage()
    }
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
    const url = normalizeUrl(partial.url.trim())
    let title = partial.title.trim()
    const artists = partial.artists

    if (!partial.id && favorites.value.some((f) => f.url === url)) {
      await showAlert(i18n.global.t('messages.url_exists') as string)
      return false
    }

    // Validate timestamps
    for (const ts of partial.timestamps) {
      if (!timeFormatIsValid(ts.time)) {
        await showAlert(i18n.global.t('messages.invalid_time_format') as string)
        return false
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

    const favoriteData: Omit<Favorite, 'id'> = {
      url,
      title,
      artists: [...artists],
      type,
      thumbnail,
      timestamps: partial.timestamps,
    }

    try {
      if (usePocketbase.value) {
        // Use Pocketbase
        if (partial.id) {
          // Update existing
          const updated = await favoritesService.update(partial.id, favoriteData)
          const existingIndex = favorites.value.findIndex((f) => f.id === partial.id)
          if (existingIndex > -1) {
            favorites.value[existingIndex] = updated
          }
        } else {
          // Create new
          const created = await favoritesService.create(favoriteData)
          favorites.value.push(created)
        }
      } else {
        // Use localStorage fallback
        const id = partial.id || String(Date.now())
        const newFavorite: Favorite = { id, ...favoriteData }
        const existingIndex = favorites.value.findIndex((f) => f.id === id)
        if (existingIndex > -1) {
          favorites.value[existingIndex] = newFavorite
        } else {
          favorites.value.push(newFavorite)
        }
      }
      await persist()
      return true
    } catch (error) {
      console.error('Error adding/updating favorite:', error)
      await showAlert(i18n.global.t('messages.error_saving') as string)
      return false
    }
  }

  async function deleteFavorite(id: string) {
    const confirmed = await showConfirm(i18n.global.t('messages.confirm_delete_favorite') as string)
    if (!confirmed) return

    try {
      if (usePocketbase.value) {
        await favoritesService.delete(id)
      }
      favorites.value = favorites.value.filter((f) => f.id !== id)
      await persist()
    } catch (error) {
      console.error('Error deleting favorite:', error)
      await showAlert(i18n.global.t('messages.error_deleting') as string)
    }
  }

  async function importFavorites(data: Favorite[]) {
    // Check for duplicates based on URL (more reliable than ID for imports)
    const existingUrls = new Set(favorites.value.map((f) => f.url))
    const existingIds = new Set(favorites.value.map((f) => f.id))
    let added = 0
    let skipped = 0

    for (const fav of data) {
      // Check for duplicates by URL for Pocketbase, by ID for localStorage
      const isDuplicate = usePocketbase.value ? existingUrls.has(fav.url) : existingIds.has(fav.id)

      if (isDuplicate) {
        skipped++
        continue
      }

      try {
        if (usePocketbase.value) {
          // Import to Pocketbase - create returns a new record with new ID
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...favoriteData } = fav
          const createdFavorite = await favoritesService.create(favoriteData)
          // Push the newly created favorite with the Pocketbase-generated ID
          favorites.value.push(createdFavorite)
          existingUrls.add(createdFavorite.url)
        } else {
          // For localStorage, keep the original ID
          favorites.value.push(fav)
          existingIds.add(fav.id)
        }
        added++
      } catch (error) {
        console.error('Error importing favorite:', error)
        skipped++
      }
    }

    if (added === 0) {
      showAlert(
        (skipped > 0
          ? (i18n.global.t('import.finished_zero_added', { skipped }) as string)
          : (i18n.global.t('import.none_or_invalid') as string)) as string,
      )
      return { added, skipped }
    }
    await persist()
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
    a.download = 'groovemark-backup.json'
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
    isLoading,
    usePocketbase,
    initialized,
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
    initializeFavorites,
  }
})
