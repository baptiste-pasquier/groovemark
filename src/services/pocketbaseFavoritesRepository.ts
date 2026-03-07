import pb from './pocketbase'
import type { Favorite } from '../types/favorite'
import type { FavoriteRecordInput, FavoritesRepository } from './favoritesRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

const COLLECTION_NAME = 'favorites'

interface PocketbaseFavorite extends Favorite {
  collectionId?: string
  collectionName?: string
  created?: string
  updated?: string
  owner?: string
}

export class PocketBaseFavoritesRepository implements FavoritesRepository {
  async list(): Promise<Favorite[]> {
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
        created: record.created,
      }))
    } catch (error) {
      console.error('Error fetching favorites from PocketBase:', error)
      throw new FavoritesRepositoryError(
        'Could not load favorites from PocketBase.',
        'read_failed',
        {
          cause: error,
        },
      )
    }
  }

  async create(favorite: FavoriteRecordInput): Promise<Favorite> {
    try {
      const record = await pb.collection(COLLECTION_NAME).create<PocketbaseFavorite>({
        ...favorite,
        owner: pb.authStore.model?.id,
      })

      return {
        id: record.id,
        url: record.url,
        title: record.title,
        artists: record.artists || [],
        type: record.type,
        thumbnail: record.thumbnail,
        timestamps: record.timestamps || [],
        created: record.created,
      }
    } catch (error) {
      console.error('Error creating favorite in PocketBase:', error)
      throw new FavoritesRepositoryError(
        'Could not create favorite in PocketBase.',
        'write_failed',
        {
          cause: error,
        },
      )
    }
  }

  async update(id: string, favorite: FavoriteRecordInput): Promise<Favorite> {
    try {
      const record = await pb.collection(COLLECTION_NAME).update<PocketbaseFavorite>(id, favorite)
      return {
        id: record.id,
        url: record.url,
        title: record.title,
        artists: record.artists || [],
        type: record.type,
        thumbnail: record.thumbnail,
        timestamps: record.timestamps || [],
        created: record.created,
      }
    } catch (error) {
      console.error('Error updating favorite in PocketBase:', error)
      throw new FavoritesRepositoryError(
        'Could not update favorite in PocketBase.',
        'write_failed',
        {
          cause: error,
        },
      )
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await pb.collection(COLLECTION_NAME).delete(id)
    } catch (error) {
      console.error('Error deleting favorite in PocketBase:', error)
      throw new FavoritesRepositoryError(
        'Could not delete favorite in PocketBase.',
        'write_failed',
        {
          cause: error,
        },
      )
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await pb.health.check()
      return true
    } catch {
      return false
    }
  }
}
