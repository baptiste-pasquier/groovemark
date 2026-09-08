import type { Favorite } from '../types/favorite'
import { LEGACY_FAVORITES_STORAGE_KEY, readStorage, removeStorage, writeStorage } from './storage'
import type { FavoriteRecordInput, FavoritesRepository } from './favoritesRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

interface LocalFavoritesRepositoryOptions {
  allowLegacyRead?: boolean
}

// Data written before artistIds existed -- or a pre-change JSON import
// re-saved locally before this feature shipped -- has no artistIds at all.
// Defaulting it here, at the localStorage read boundary, keeps every
// artistIds.includes(...) call elsewhere safe without scattering the same
// guard through the UI layer. The favorite still renders its names via the
// untouched `artists` column; it just carries no relation until it is next
// saved through the artist field.
function normalizeStoredFavorite(favorite: Favorite): Favorite {
  return favorite.artistIds ? favorite : { ...favorite, artistIds: [] }
}

export class LocalFavoritesRepository implements FavoritesRepository {
  private storageKey: string
  private allowLegacyRead: boolean

  constructor(storageKey: string, options: LocalFavoritesRepositoryOptions = {}) {
    this.storageKey = storageKey
    this.allowLegacyRead = options.allowLegacyRead ?? false
  }

  async list(): Promise<Favorite[]> {
    const favorites = readStorage<Favorite[]>(this.storageKey)
    if (favorites) {
      return favorites.map(normalizeStoredFavorite)
    }

    if (this.allowLegacyRead) {
      const legacyFavorites = readStorage<Favorite[]>(LEGACY_FAVORITES_STORAGE_KEY)
      if (legacyFavorites) {
        const normalizedLegacyFavorites = legacyFavorites.map(normalizeStoredFavorite)
        await this.replaceAll(normalizedLegacyFavorites)
        removeStorage(LEGACY_FAVORITES_STORAGE_KEY)
        return normalizedLegacyFavorites
      }
    }

    return []
  }

  async create(favorite: FavoriteRecordInput): Promise<Favorite> {
    const favorites = await this.list()
    const createdFavorite: Favorite = {
      ...favorite,
      id: crypto.randomUUID(),
      created: new Date().toISOString(),
    }
    favorites.push(createdFavorite)
    await this.replaceAll(favorites)
    return createdFavorite
  }

  async update(id: string, favorite: FavoriteRecordInput): Promise<Favorite> {
    const favorites = await this.list()
    const existingFavorite = favorites.find((item) => item.id === id)

    if (!existingFavorite) {
      throw new FavoritesRepositoryError('Favorite not found.', 'write_failed')
    }

    const updatedFavorite: Favorite = {
      ...favorite,
      id,
      created: existingFavorite.created,
    }
    const updatedFavorites = favorites.map((item) => (item.id === id ? updatedFavorite : item))
    await this.replaceAll(updatedFavorites)
    return updatedFavorite
  }

  async delete(id: string): Promise<void> {
    const favorites = await this.list()
    await this.replaceAll(favorites.filter((item) => item.id !== id))
  }

  async replaceAll(favorites: Favorite[]) {
    writeStorage(this.storageKey, favorites)
  }
}
