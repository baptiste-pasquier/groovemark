import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { LocalArtistsRepository } from '../services/localArtistsRepository'
import { PocketBaseArtistsRepository } from '../services/pocketbaseArtistsRepository'
import { FavoritesRepositoryError } from '../services/favoritesRepository'
import { getArtistsStorageKey } from '../services/storage'
import { getLocalStorageState, localStorageMock, resetLocalStorageMock } from './mocks/localStorage'
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

  it('serializes concurrent creates so a race on the same slug cannot silently drop one artist', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    // Fired without awaiting between them, so both read the empty storage
    // before either has written -- exactly the race a non-atomic
    // list -> find -> push -> replaceAll can lose without a write lock.
    const results = await Promise.allSettled([
      repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' }),
      repository.create({ displayName: 'Daft Punk (dup)', slug: 'daft-punk' }),
    ])

    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(FavoritesRepositoryError)

    const artists = await repository.list()
    expect(artists).toHaveLength(1)
  })

  it('createMany resolves a whole population in a single locked write, reusing an existing slug', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    const existing = await repository.create({
      displayName: 'Existing Artist',
      slug: 'existing artist',
    })

    const results = await repository.createMany([
      { displayName: 'Existing Artist', slug: 'existing artist' },
      { displayName: 'New Artist A', slug: 'new artist a' },
      { displayName: 'New Artist B', slug: 'new artist b' },
    ])

    expect(results).toEqual([
      existing,
      expect.objectContaining({ displayName: 'New Artist A', slug: 'new artist a' }),
      expect.objectContaining({ displayName: 'New Artist B', slug: 'new artist b' }),
    ])

    const stored = await repository.list()
    expect(stored).toHaveLength(3)
  })

  // A refused localStorage write (quota exceeded, Safari private browsing)
  // discards the artist just created: the key holds every artist and is
  // rewritten whole. Reporting success here would credit an artist on an event
  // that is gone on the next reload.
  it('rejects create when the storage write is refused', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    await expect(
      repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' }),
    ).rejects.toBeInstanceOf(FavoritesRepositoryError)
  })

  it('rejects createMany when the storage write is refused', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    await expect(
      repository.createMany([{ displayName: 'Daft Punk', slug: 'daft-punk' }]),
    ).rejects.toBeInstanceOf(FavoritesRepositoryError)
  })

  it('createMany shares the same write lock as create, so the two cannot race each other', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)

    await Promise.all([
      repository.create({ displayName: 'Solo Artist', slug: 'solo artist' }),
      repository.createMany([{ displayName: 'Batch Artist', slug: 'batch artist' }]),
    ])

    const stored = await repository.list()
    expect(stored.map((artist) => artist.slug).sort()).toEqual(['batch artist', 'solo artist'])
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
