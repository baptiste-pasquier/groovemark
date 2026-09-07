import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { LocalArtistsRepository } from '../services/localArtistsRepository'
import { PocketBaseArtistsRepository } from '../services/pocketbaseArtistsRepository'
import { FavoritesRepositoryError } from '../services/favoritesRepository'
import { getArtistsStorageKey } from '../services/storage'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'
import {
  mockPocketbase,
  pocketbaseArtistsCollectionApi,
  resetPocketbaseMocks,
} from './mocks/pocketbase'

describe('LocalArtistsRepository', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  it('round-trips an artist through its own storage key', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    const created = await repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' })
    const artists = await repository.list()

    expect(artists).toEqual([created])
    expect(getLocalStorageState()[storageKey]).toBe(JSON.stringify([created]))
  })

  it('never writes to a favorites storage key', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    await repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' })

    const favoritesKeys = Object.keys(getLocalStorageState()).filter((key) =>
      key.startsWith('groovemark:favorites:'),
    )
    expect(favoritesKeys).toEqual([])
  })

  it('rejects creating two artists with the same slug', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    await repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' })

    await expect(
      repository.create({ displayName: 'Daft Punk (dup)', slug: 'daft-punk' }),
    ).rejects.toBeInstanceOf(FavoritesRepositoryError)
  })

  it('findBySlug returns the existing artist after a create was rejected by the index', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    const original = await repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' })

    await expect(
      repository.create({ displayName: 'Daft Punk (dup)', slug: 'daft-punk' }),
    ).rejects.toBeInstanceOf(FavoritesRepositoryError)

    const found = await repository.findBySlug('daft-punk')
    expect(found).toEqual(original)
  })
})

describe('PocketBaseArtistsRepository', () => {
  beforeEach(() => {
    resetPocketbaseMocks()
    mockPocketbase.authStore.model = { id: 'user-1' }
  })

  const repository = new PocketBaseArtistsRepository()

  it('surfaces a backend create failure as a FavoritesRepositoryError the rate-limit guard recognises', async () => {
    pocketbaseArtistsCollectionApi.create.mockRejectedValue(
      Object.assign(new Error('rate limited'), { status: 429 }),
    )

    let thrown: unknown
    try {
      await repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(FavoritesRepositoryError)
    const causeStatus = (thrown as FavoritesRepositoryError).cause as { status?: number }
    expect(causeStatus.status).toBe(429)
  })
})
