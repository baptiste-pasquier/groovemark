import type { Artist } from '../types/artist'
import type { Favorite } from '../types/favorite'
import type { AuthMode } from '../types/auth'
import { getArtistsStorageKey, getFavoritesStorageKey } from './storage'
import { LocalFavoritesRepository } from './localFavoritesRepository'
import { PocketBaseFavoritesRepository } from './pocketbaseFavoritesRepository'
import type { ArtistsRepository } from './artistsRepository'
import { LocalArtistsRepository } from './localArtistsRepository'
import { PocketBaseArtistsRepository } from './pocketbaseArtistsRepository'

export type RepositoryMode = 'local' | 'google-cloud' | 'google-cache'

export interface FavoriteRecordInput {
  url: string
  title: string
  artists: string[]
  artistIds: string[]
  type: Favorite['type']
  thumbnail: string
  timestamps: Favorite['timestamps']
  created?: string
}

export class FavoritesRepositoryError extends Error {
  code: 'invalid_context' | 'read_failed' | 'write_failed' | 'unavailable'
  cause?: unknown

  constructor(
    message: string,
    code: FavoritesRepositoryError['code'],
    options?: { cause?: unknown },
  ) {
    super(message)
    this.name = 'FavoritesRepositoryError'
    this.code = code
    this.cause = options?.cause
  }
}

export interface FavoritesRepository {
  list(): Promise<Favorite[]>
  create(favorite: FavoriteRecordInput): Promise<Favorite>
  update(id: string, favorite: FavoriteRecordInput): Promise<Favorite>
  delete(id: string): Promise<void>
  isAvailable?(): Promise<boolean>
}

export interface RepositorySelection {
  activeRepository: FavoritesRepository
  cacheRepository: LocalFavoritesRepository
  activeArtistsRepository: ArtistsRepository
  cacheArtistsRepository: LocalArtistsRepository
  mode: RepositoryMode
}

interface FavoritesRepositoryContext {
  authMode: Exclude<AuthMode, null>
  userId?: string | null
  backendAvailable: boolean
}

export interface SessionInitOptions {
  backendAvailable: boolean
  force?: boolean
}

class ReadOnlyFavoritesRepository implements FavoritesRepository {
  constructor(private readonly inner: LocalFavoritesRepository) {}

  list(): Promise<Favorite[]> {
    return this.inner.list()
  }

  create(): Promise<Favorite> {
    throw new FavoritesRepositoryError('Favorites are read-only while offline.', 'unavailable')
  }

  update(): Promise<Favorite> {
    throw new FavoritesRepositoryError('Favorites are read-only while offline.', 'unavailable')
  }

  delete(): Promise<void> {
    throw new FavoritesRepositoryError('Favorites are read-only while offline.', 'unavailable')
  }
}

class ReadOnlyArtistsRepository implements ArtistsRepository {
  constructor(private readonly inner: LocalArtistsRepository) {}

  list(): Promise<Artist[]> {
    return this.inner.list()
  }

  findBySlug(slug: string): Promise<Artist | null> {
    return this.inner.findBySlug(slug)
  }

  create(): Promise<Artist> {
    throw new FavoritesRepositoryError('Artists are read-only while offline.', 'unavailable')
  }
}

export function selectRepositories(context: FavoritesRepositoryContext): RepositorySelection {
  const cacheRepository = new LocalFavoritesRepository(
    getFavoritesStorageKey(context.authMode, context.userId),
    {
      allowLegacyRead: context.authMode === 'local',
    },
  )
  const cacheArtistsRepository = new LocalArtistsRepository(
    getArtistsStorageKey(context.authMode, context.userId),
  )

  if (context.authMode === 'local') {
    return {
      activeRepository: cacheRepository,
      cacheRepository,
      activeArtistsRepository: cacheArtistsRepository,
      cacheArtistsRepository,
      mode: 'local',
    }
  }

  if (!context.userId) {
    throw new FavoritesRepositoryError('Google favorites require a user id.', 'invalid_context')
  }

  if (!context.backendAvailable) {
    return {
      activeRepository: new ReadOnlyFavoritesRepository(cacheRepository),
      cacheRepository,
      activeArtistsRepository: new ReadOnlyArtistsRepository(cacheArtistsRepository),
      cacheArtistsRepository,
      mode: 'google-cache',
    }
  }

  return {
    activeRepository: new PocketBaseFavoritesRepository(),
    cacheRepository,
    activeArtistsRepository: new PocketBaseArtistsRepository(),
    cacheArtistsRepository,
    mode: 'google-cloud',
  }
}
