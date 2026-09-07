import type { Artist } from '../types/artist'
import { readStorage, writeStorage } from './storage'
import type { ArtistRecordInput, ArtistsRepository } from './artistsRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

export class LocalArtistsRepository implements ArtistsRepository {
  private storageKey: string

  constructor(storageKey: string) {
    this.storageKey = storageKey
  }

  async list(): Promise<Artist[]> {
    return readStorage<Artist[]>(this.storageKey) ?? []
  }

  async create(input: ArtistRecordInput): Promise<Artist> {
    const artists = await this.list()
    const existingArtist = artists.find((artist) => artist.slug === input.slug)

    if (existingArtist) {
      throw new FavoritesRepositoryError('An artist with this name already exists.', 'write_failed')
    }

    const createdArtist: Artist = {
      ...input,
      id: crypto.randomUUID(),
    }
    artists.push(createdArtist)
    await this.replaceAll(artists)
    return createdArtist
  }

  async findBySlug(slug: string): Promise<Artist | null> {
    const artists = await this.list()
    return artists.find((artist) => artist.slug === slug) ?? null
  }

  async replaceAll(artists: Artist[]) {
    writeStorage(this.storageKey, artists)
  }
}
