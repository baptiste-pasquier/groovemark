import type { Favorite } from '../types/favorite'
import { LEGACY_FAVORITES_STORAGE_KEY, readStorage, removeStorage, writeStorage } from './storage'
import type { FavoriteRecordInput, FavoritesRepository } from './favoritesRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

interface LocalFavoritesRepositoryOptions {
  allowLegacyRead?: boolean
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
      return favorites
    }

    if (this.allowLegacyRead) {
      const legacyFavorites = readStorage<Favorite[]>(LEGACY_FAVORITES_STORAGE_KEY)
      if (legacyFavorites) {
        await this.replaceAll(legacyFavorites)
        removeStorage(LEGACY_FAVORITES_STORAGE_KEY)
        return legacyFavorites
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
