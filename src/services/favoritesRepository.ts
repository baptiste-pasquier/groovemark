import type { Favorite } from '../types/favorite'
import type { AuthMode } from '../types/auth'
import { getFavoritesStorageKey } from './storage'
import { LocalFavoritesRepository } from './localFavoritesRepository'
import { PocketBaseFavoritesRepository } from './pocketbaseFavoritesRepository'

export type RepositoryMode = 'local' | 'google-cloud' | 'google-cache'

export interface FavoriteRecordInput {
  url: string
  title: string
  artists: string[]
  type: Favorite['type']
  thumbnail: string
  timestamps: Favorite['timestamps']
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

export interface FavoritesRepositorySelection {
  activeRepository: FavoritesRepository
  cacheRepository: LocalFavoritesRepository
  mode: RepositoryMode
}

interface FavoritesRepositoryContext {
  authMode: Exclude<AuthMode, null>
  userId?: string | null
  backendAvailable: boolean
}

export function selectFavoritesRepository(
  context: FavoritesRepositoryContext,
): FavoritesRepositorySelection {
  const cacheRepository = new LocalFavoritesRepository(
    getFavoritesStorageKey(context.authMode, context.userId),
    {
      allowLegacyRead: context.authMode === 'local',
    },
  )

  if (context.authMode === 'local') {
    return {
      activeRepository: cacheRepository,
      cacheRepository,
      mode: 'local',
    }
  }

  if (!context.userId) {
    throw new FavoritesRepositoryError('Google favorites require a user id.', 'invalid_context')
  }

  if (!context.backendAvailable) {
    return {
      activeRepository: cacheRepository,
      cacheRepository,
      mode: 'google-cache',
    }
  }

  return {
    activeRepository: new PocketBaseFavoritesRepository(),
    cacheRepository,
    mode: 'google-cloud',
  }
}
