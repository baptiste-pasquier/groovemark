import pb from './pocketbase'
import type { Favorite } from '../types/favorite'

const COLLECTION_NAME = 'favorites'

export interface PocketbaseFavorite extends Favorite {
  collectionId?: string
  collectionName?: string
  created?: string
  updated?: string
  user?: string
}

export const favoritesService = {
  /**
   * Get all favorites from Pocketbase
   */
  async getAll(): Promise<Favorite[]> {
    try {
      const records = await pb.collection(COLLECTION_NAME).getFullList<PocketbaseFavorite>({
        sort: '-created',
      })
      return records.map((record) => ({
        id: record.id,
        url: record.url,
        title: record.title,
        artists: record.artists || [],
        type: record.type,
        thumbnail: record.thumbnail,
        timestamps: record.timestamps || [],
      }))
    } catch (error) {
      console.error('Error fetching favorites from Pocketbase:', error)
      // If collection doesn't exist or server is unavailable, return empty array
      // The store will fall back to localStorage
      return []
    }
  },

  /**
   * Create a new favorite in Pocketbase
   */
  async create(favorite: Omit<Favorite, 'id'>): Promise<Favorite> {
    const data = {
      ...favorite,
      user: pb.authStore.model?.id,
    }
    const record = await pb.collection(COLLECTION_NAME).create<PocketbaseFavorite>(data)
    return {
      id: record.id,
      url: record.url,
      title: record.title,
      artists: record.artists || [],
      type: record.type,
      thumbnail: record.thumbnail,
      timestamps: record.timestamps || [],
    }
  },

  /**
   * Update an existing favorite in Pocketbase
   */
  async update(id: string, favorite: Partial<Favorite>): Promise<Favorite> {
    const record = await pb.collection(COLLECTION_NAME).update<PocketbaseFavorite>(id, favorite)
    return {
      id: record.id,
      url: record.url,
      title: record.title,
      artists: record.artists || [],
      type: record.type,
      thumbnail: record.thumbnail,
      timestamps: record.timestamps || [],
    }
  },

  /**
   * Delete a favorite from Pocketbase
   */
  async delete(id: string): Promise<void> {
    await pb.collection(COLLECTION_NAME).delete(id)
  },

  /**
   * Check if Pocketbase is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await pb.health.check()
      return true
    } catch {
      return false
    }
  },
}
