import type { Artist } from '../types/artist'

export interface ArtistRecordInput {
  displayName: string
  slug: string
}

export interface ArtistsRepository {
  list(): Promise<Artist[]>
  create(input: ArtistRecordInput): Promise<Artist>
  findBySlug(slug: string): Promise<Artist | null>
  // Optional batch path: one round-trip for a whole population of new
  // artists instead of one `create` per artist. Only local storage can do
  // this safely without a real bulk-create endpoint (KTD8 keeps remote
  // creates sequential through the shared retry/rate-limiter). Resolves
  // each input to an Artist 1:1, reusing an existing record for any slug
  // that already exists instead of rejecting it.
  createMany?(inputs: ArtistRecordInput[]): Promise<Artist[]>
}
