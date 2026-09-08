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
  selection: RepositorySelection
  force?: boolean
}

// Wraps `inner`, delegating the named read methods and replacing every other
// method with one that throws `unavailableMessage`. Both read-only
// repositories (favorites, artists) are the same shape -- reads work against
// the local cache, every write is rejected -- so this is the one place that
// shape is expressed, instead of one hand-written class per repository.
function createReadOnlyRepository<TRepo extends object>(
  inner: TRepo,
  readMethodNames: readonly (keyof TRepo)[],
  writeMethodNames: readonly (keyof TRepo)[],
  unavailableMessage: string,
): TRepo {
  const repository: Record<string, unknown> = {}

  for (const name of readMethodNames) {
    const method = inner[name]
    if (typeof method === 'function') {
      repository[name as string] = method.bind(inner)
    }
  }

  for (const name of writeMethodNames) {
    repository[name as string] = () => {
      throw new FavoritesRepositoryError(unavailableMessage, 'unavailable')
    }
  }

  return repository as TRepo
}

function createReadOnlyFavoritesRepository(inner: LocalFavoritesRepository): FavoritesRepository {
  return createReadOnlyRepository<FavoritesRepository>(
    inner,
    ['list'],
    ['create', 'update', 'delete'],
    'Favorites are read-only while offline.',
  )
}

function createReadOnlyArtistsRepository(inner: LocalArtistsRepository): ArtistsRepository {
  return createReadOnlyRepository<ArtistsRepository>(
    inner,
    ['list', 'findBySlug'],
    ['create'],
    'Artists are read-only while offline.',
  )
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
      activeRepository: createReadOnlyFavoritesRepository(cacheRepository),
      cacheRepository,
      activeArtistsRepository: createReadOnlyArtistsRepository(cacheArtistsRepository),
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
