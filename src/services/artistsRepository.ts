import type { Artist } from '../types/artist'

export interface ArtistRecordInput {
  displayName: string
  slug: string
}

export interface ArtistsRepository {
  list(): Promise<Artist[]>
  create(input: ArtistRecordInput): Promise<Artist>
  findBySlug(slug: string): Promise<Artist | null>
  isAvailable?(): Promise<boolean>
}
