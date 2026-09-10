import type { Artist } from '../types/artist'
import { createWriteQueue, readStorage, writeStorage } from './storage'
import type { ArtistRecordInput, ArtistsRepository } from './artistsRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

export class LocalArtistsRepository implements ArtistsRepository {
  private storageKey: string
  // `create` and `createMany` both do list -> mutate -> replaceAll, so every
  // write goes through the shared queue.
  private enqueue = createWriteQueue()

  constructor(storageKey: string) {
    this.storageKey = storageKey
  }

  async list(): Promise<Artist[]> {
    return readStorage<Artist[]>(this.storageKey) ?? []
  }

  async create(input: ArtistRecordInput): Promise<Artist> {
    return this.enqueue(async () => {
      const artists = await this.list()
      const existingArtist = artists.find((artist) => artist.slug === input.slug)

      if (existingArtist) {
        throw new FavoritesRepositoryError(
          'An artist with this name already exists.',
          'write_failed',
        )
      }

      const createdArtist: Artist = {
        ...input,
        id: crypto.randomUUID(),
      }
      artists.push(createdArtist)
      await this.replaceAll(artists)
      return createdArtist
    })
  }

  // Resolves a whole population of artists in one locked read-modify-write
  // instead of one per artist. A slug already present (raced in separately,
  // or resolved from a stale in-memory index) is reused rather than
  // rejected, mirroring the create-or-find recovery in utils/artist.ts.
  async createMany(inputs: ArtistRecordInput[]): Promise<Artist[]> {
    return this.enqueue(async () => {
      const artists = await this.list()
      const bySlug = new Map(artists.map((artist) => [artist.slug, artist]))
      const results: Artist[] = []
      let didCreate = false

      for (const input of inputs) {
        const existingArtist = bySlug.get(input.slug)
        if (existingArtist) {
          results.push(existingArtist)
          continue
        }

        const createdArtist: Artist = {
          ...input,
          id: crypto.randomUUID(),
        }
        bySlug.set(input.slug, createdArtist)
        artists.push(createdArtist)
        results.push(createdArtist)
        didCreate = true
      }

      if (didCreate) {
        await this.replaceAll(artists)
      }
      return results
    })
  }

  async findBySlug(slug: string): Promise<Artist | null> {
    const artists = await this.list()
    return artists.find((artist) => artist.slug === slug) ?? null
  }

  async replaceAll(artists: Artist[]) {
    writeStorage(this.storageKey, artists)
  }
}
