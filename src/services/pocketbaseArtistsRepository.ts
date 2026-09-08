import pb from './pocketbase'
import type { Artist } from '../types/artist'
import type { ArtistRecordInput, ArtistsRepository } from './artistsRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

const COLLECTION_NAME = 'artists'

interface PocketbaseArtist extends Artist {
  collectionId?: string
  collectionName?: string
  owner?: string
}

function toArtist(record: PocketbaseArtist): Artist {
  return {
    id: record.id,
    displayName: record.displayName,
    slug: record.slug,
  }
}

export class PocketBaseArtistsRepository implements ArtistsRepository {
  async list(): Promise<Artist[]> {
    try {
      const records = await pb.collection(COLLECTION_NAME).getFullList<PocketbaseArtist>()
      return records.map(toArtist)
    } catch (error) {
      console.error('Error fetching artists from PocketBase:', error)
      throw new FavoritesRepositoryError('Could not load artists from PocketBase.', 'read_failed', {
        cause: error,
      })
    }
  }

  async create(input: ArtistRecordInput): Promise<Artist> {
    try {
      const record = await pb.collection(COLLECTION_NAME).create<PocketbaseArtist>({
        displayName: input.displayName,
        slug: input.slug,
        owner: pb.authStore.model?.id,
      })

      return toArtist(record)
    } catch (error) {
      console.error('Error creating artist in PocketBase:', error)
      throw new FavoritesRepositoryError('Could not create artist in PocketBase.', 'write_failed', {
        cause: error,
      })
    }
  }

  async findBySlug(slug: string): Promise<Artist | null> {
    try {
      const record = await pb
        .collection(COLLECTION_NAME)
        .getFirstListItem<PocketbaseArtist>(pb.filter('slug = {:slug}', { slug }))

      return toArtist(record)
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { status?: unknown }).status === 404
      ) {
        return null
      }

      console.error('Error finding artist in PocketBase:', error)
      throw new FavoritesRepositoryError('Could not load artist from PocketBase.', 'read_failed', {
        cause: error,
      })
    }
  }
}
