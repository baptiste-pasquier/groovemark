import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '../i18n'
import type { Favorite, Timestamp } from '../types/favorite'
import { getYoutubeVideoId, isSafeHttpUrl, isSoundCloudUrl, normalizeUrl } from '../utils/url'
import { timeFormatIsValid } from '../utils/favorite'
import type {
  FavoriteRecordInput,
  FavoritesRepository,
  RepositoryMode,
} from '../services/favoritesRepository'
import { selectFavoritesRepository } from '../services/favoritesRepository'
import { LocalFavoritesRepository } from '../services/localFavoritesRepository'
import { useAuthStore } from './auth'
import { useFavoritesUiStore } from './favoritesUi'
import { FavoriteImportError, parseFavoritesImportFile } from '../services/favoriteImport'

interface InitializeFavoritesOptions {
  backendAvailable: boolean
  force?: boolean
}

interface FavoriteDraft {
  id?: string
  url: string
  title: string
  artists: string[]
  timestamps: Timestamp[]
  thumbnail?: string
}

const DEFAULT_THUMBNAIL = 'https://placehold.co/600x400/e2e8f0/adb5bd?text=Miniature'

export const useFavoritesStore = defineStore('favorites', () => {
  const favorites = ref<Favorite[]>([])
  const isLoading = ref(false)
  const repositoryMode = ref<RepositoryMode>('local')
  const initialized = ref(false)

  let activeRepository: FavoritesRepository | null = null
  let cacheRepository: LocalFavoritesRepository | null = null
  let sessionKey = ''

  const authStore = useAuthStore()

  function getCurrentSessionKey() {
    return `${authStore.authMode ?? 'none'}:${authStore.userId ?? 'anonymous'}`
  }

  async function initializeForCurrentSession(options: InitializeFavoritesOptions) {
    if (!authStore.authMode) {
      $reset()
      return
    }

    const nextSessionKey = getCurrentSessionKey()
    if (initialized.value && !options.force && sessionKey === nextSessionKey) {
      return
    }

    isLoading.value = true
    initialized.value = true
    sessionKey = nextSessionKey

    const selection = selectFavoritesRepository({
      authMode: authStore.authMode,
      userId: authStore.userId,
      backendAvailable: options.backendAvailable,
    })
    activeRepository = selection.activeRepository
    cacheRepository = selection.cacheRepository
    repositoryMode.value = selection.mode

    try {
      favorites.value = await activeRepository.list()
      await persistCacheSnapshot()
    } catch (error) {
      console.error('Error initializing favorites:', error)

      if (repositoryMode.value === 'google-cloud' && cacheRepository) {
        favorites.value = await cacheRepository.list()
        activeRepository = cacheRepository
        repositoryMode.value = 'google-cache'
      } else {
        favorites.value = []
      }
    } finally {
      isLoading.value = false
    }
  }

  async function persistCacheSnapshot() {
    if (!cacheRepository) return
    await cacheRepository.replaceAll(favorites.value)
  }

  function buildFavoriteRecordInput(
    draft: FavoriteDraft,
    currentFavorite?: Favorite,
  ): FavoriteRecordInput {
    const type: Favorite['type'] = isSoundCloudUrl(draft.url) ? 'soundcloud' : 'youtube'
    const normalizedThumbnail = draft.thumbnail?.trim() || ''
    const hasUrlChanged = currentFavorite ? currentFavorite.url !== draft.url : false
    const hasFreshThumbnail =
      normalizedThumbnail.length > 0 && normalizedThumbnail !== currentFavorite?.thumbnail

    let thumbnail = hasUrlChanged
      ? hasFreshThumbnail
        ? normalizedThumbnail
        : DEFAULT_THUMBNAIL
      : normalizedThumbnail || currentFavorite?.thumbnail || DEFAULT_THUMBNAIL

    if (type === 'youtube' && thumbnail === DEFAULT_THUMBNAIL) {
      const videoId = getYoutubeVideoId(draft.url)
      if (videoId) {
        thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }
    }

    return {
      url: draft.url,
      title: draft.title.trim(),
      artists: [...draft.artists],
      type,
      thumbnail,
      timestamps: draft.timestamps,
    }
  }

  function getImportErrorMessage(error: FavoriteImportError) {
    switch (error.code) {
      case 'invalid_array':
        return i18n.global.t('import.error_invalid_array')
      case 'invalid_structure':
        return i18n.global.t('import.error_invalid_structure')
      case 'invalid_json':
      default:
        return i18n.global.t('import.error_invalid_json')
    }
  }

  async function addOrUpdateFavorite(draft: FavoriteDraft) {
    const favoritesUiStore = useFavoritesUiStore()
    const normalizedUrl = await normalizeUrl(draft.url.trim())
    const duplicateFavorite = favorites.value.find(
      (favorite) => favorite.url === normalizedUrl && favorite.id !== draft.id,
    )

    if (duplicateFavorite) {
      await favoritesUiStore.showAlert(i18n.global.t('messages.url_exists'), 'alert')
      return false
    }

    for (const timestamp of draft.timestamps) {
      if (!timeFormatIsValid(timestamp.time)) {
        await favoritesUiStore.showAlert(i18n.global.t('messages.invalid_time_format'), 'alert')
        return false
      }
    }

    const currentFavorite = draft.id
      ? favorites.value.find((favorite) => favorite.id === draft.id)
      : undefined
    const favoriteInput = buildFavoriteRecordInput(
      {
        ...draft,
        url: normalizedUrl,
      },
      currentFavorite,
    )

    try {
      if (!activeRepository) {
        throw new Error('Favorites repository has not been initialized.')
      }

      if (draft.id) {
        const updatedFavorite = await activeRepository.update(draft.id, favoriteInput)
        favorites.value = favorites.value.map((favorite) =>
          favorite.id === draft.id ? updatedFavorite : favorite,
        )
      } else {
        const createdFavorite = await activeRepository.create(favoriteInput)
        favorites.value.push(createdFavorite)
      }

      await persistCacheSnapshot()
      return true
    } catch (error) {
      console.error('Error adding/updating favorite:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_saving'), 'alert')
      return false
    }
  }

  async function deleteFavorite(id: string) {
    const favoritesUiStore = useFavoritesUiStore()
    const confirmed = await favoritesUiStore.showConfirm(
      i18n.global.t('messages.confirm_delete_favorite'),
    )
    if (!confirmed) return

    try {
      if (!activeRepository) {
        throw new Error('Favorites repository has not been initialized.')
      }

      await activeRepository.delete(id)
      favorites.value = favorites.value.filter((favorite) => favorite.id !== id)
      await persistCacheSnapshot()
    } catch (error) {
      console.error('Error deleting favorite:', error)
      await favoritesUiStore.showAlert(i18n.global.t('messages.error_deleting'), 'alert')
    }
  }

  async function importFavorites(data: Favorite[]) {
    const favoritesUiStore = useFavoritesUiStore()
    const existingUrls = new Set(favorites.value.map((favorite) => favorite.url))
    const usesCloudRepository = repositoryMode.value === 'google-cloud'
    let added = 0
    let skipped = 0

    for (const favorite of data) {
      const normalizedUrl = await normalizeUrl(favorite.url)

      if (!isSafeHttpUrl(normalizedUrl)) {
        skipped++
        continue
      }

      if (existingUrls.has(normalizedUrl)) {
        skipped++
        continue
      }

      try {
        if (usesCloudRepository && activeRepository) {
          const createdFavorite = await activeRepository.create({
            url: normalizedUrl,
            title: favorite.title,
            artists: favorite.artists || [],
            type: favorite.type,
            thumbnail: favorite.thumbnail || DEFAULT_THUMBNAIL,
            timestamps: favorite.timestamps || [],
          })
          favorites.value.push(createdFavorite)
        } else {
          favorites.value.push({
            ...favorite,
            url: normalizedUrl,
            created: favorite.created || new Date().toISOString(),
          })
        }
        existingUrls.add(normalizedUrl)
        added++
      } catch (error) {
        console.error('Error importing favorite:', error)
        skipped++
      }
    }

    await persistCacheSnapshot()

    if (added === 0) {
      if (skipped > 0) {
        await favoritesUiStore.showAlert(
          i18n.global.t('import.finished_zero_added', { skipped }),
          'info',
        )
      } else {
        await favoritesUiStore.showAlert(i18n.global.t('import.none_or_invalid'), 'alert')
      }
      return { added, skipped }
    }

    await favoritesUiStore.showAlert(
      i18n.global.t('import.added', { count: added }) +
        (skipped ? i18n.global.t('import.with_skipped', { skipped }) : '.'),
      'info',
    )

    return { added, skipped }
  }

  async function importFromFile(file: File) {
    const favoritesUiStore = useFavoritesUiStore()

    try {
      const favoritesToImport = await parseFavoritesImportFile(file)
      return await importFavorites(favoritesToImport)
    } catch (error) {
      if (error instanceof FavoriteImportError) {
        await favoritesUiStore.showAlert(
          `${i18n.global.t('import.error_prefix')}${getImportErrorMessage(error)}`,
          'alert',
        )
        return null
      }

      throw error
    }
  }

  async function exportFavorites() {
    const favoritesUiStore = useFavoritesUiStore()
    if (favorites.value.length === 0) {
      await favoritesUiStore.showAlert(i18n.global.t('export.no_favorites'), 'alert')
      return
    }

    const jsonString = JSON.stringify(favorites.value, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'groovemark-backup.json'
    anchor.click()
    URL.revokeObjectURL(url)
    anchor.remove()
  }

  function $reset() {
    favorites.value = []
    isLoading.value = false
    repositoryMode.value = 'local'
    initialized.value = false
    activeRepository = null
    cacheRepository = null
    sessionKey = ''
  }

  return {
    favorites,
    isLoading,
    repositoryMode,
    initialized,
    initializeForCurrentSession,
    addOrUpdateFavorite,
    deleteFavorite,
    importFavorites,
    importFromFile,
    exportFavorites,
    $reset,
  }
})
