import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { LocalEventsRepository } from '../services/localEventsRepository'
import { PocketBaseEventsRepository } from '../services/pocketbaseEventsRepository'
import { FavoritesRepositoryError, selectRepositories } from '../services/favoritesRepository'
import { getEventsStorageKey } from '../services/storage'
import type { EventRecordInput } from '../services/eventsRepository'
import { BATCH_MAX_REQUESTS } from '../utils/event'
import { resetLocalStorageMock } from './mocks/localStorage'
import {
  mockPocketbase,
  pocketbaseBatchApi,
  pocketbaseEventsCollectionApi,
  pocketbasePerformancesCollectionApi,
  resetPocketbaseMocks,
} from './mocks/pocketbase'

const OWNER_ID = 'google-user'
// The migration whose absence leaves /api/batch disabled. Named here so the
// spec fails if the repository's message stops pointing at a real file.
const BATCH_MIGRATION = '1789067402_enable_batch'

function eventInput(overrides: Partial<EventRecordInput> = {}): EventRecordInput {
  return {
    name: 'Nuits Sonores',
    dateAttended: '2026-05-14',
    venue: 'Les Subsistances',
    performances: [
      { artistId: 'artist-1', artistName: 'Daft Punk', verdict: 'three-stars' },
      { artistId: 'artist-2', artistName: 'Justice', verdict: null },
      { artistId: 'artist-3', artistName: 'Air', verdict: 'dislike' },
    ],
    ...overrides,
  }
}

// A performance row exactly as PocketBase returns it: `verdict` is an empty
// string when unrated (the select field normalises absent to ''), never null.
function serverPerformance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'performance-1',
    collectionId: 'pbc_2758201643',
    collectionName: 'performances',
    eventId: 'event-1',
    artistId: 'artist-1',
    artistName: 'Daft Punk',
    verdict: 'three-stars',
    owner: OWNER_ID,
    created: '2026-05-14 21:00:00.000Z',
    updated: '2026-05-14 21:00:00.000Z',
    ...overrides,
  }
}

// An event row as PocketBase returns it: `dateAttended` is a date field, so the
// server stores and returns the day as a full timestamp.
function serverEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    collectionId: 'pbc_1093733721',
    collectionName: 'events',
    name: 'Nuits Sonores',
    dateAttended: '2026-05-04 00:00:00.000Z',
    venue: 'Les Subsistances',
    owner: OWNER_ID,
    created: '2026-05-14 21:00:00.000Z',
    updated: '2026-05-14 21:00:00.000Z',
    ...overrides,
  }
}

function manyPerformances(count: number) {
  return Array.from({ length: count }, (unused, index) => ({
    artistId: `artist-${index}`,
    artistName: `Artist ${index}`,
    verdict: null,
  }))
}

describe('PocketBaseEventsRepository', () => {
  beforeEach(() => {
    resetLocalStorageMock()
    resetPocketbaseMocks()
    mockPocketbase.authStore.isValid = true
    mockPocketbase.authStore.model = { id: OWNER_ID }
  })

  it('writes the event and every performance row in one batch', async () => {
    const repository = new PocketBaseEventsRepository()

    await repository.create(eventInput())

    expect(mockPocketbase.createBatch).toHaveBeenCalledTimes(1)
    expect(pocketbaseBatchApi.send).toHaveBeenCalledTimes(1)
    expect(pocketbaseBatchApi.requests).toHaveLength(4)
    expect(pocketbaseBatchApi.requests.map((request) => request.collection)).toEqual([
      'events',
      'performances',
      'performances',
      'performances',
    ])
    // Nothing is written outside the transaction, so there is no partial state
    // a failure could leave behind (R8).
    expect(pocketbaseEventsCollectionApi.create).not.toHaveBeenCalled()
    expect(pocketbasePerformancesCollectionApi.create).not.toHaveBeenCalled()

    // Every request submits the owner explicitly: the create rules require it
    // (R25).
    for (const request of pocketbaseBatchApi.requests) {
      expect(request.data).toMatchObject({ owner: OWNER_ID })
    }
  })

  it('gives every performance row the client-minted event id, not a server-assigned one', async () => {
    const repository = new PocketBaseEventsRepository()

    const created = await repository.create(eventInput())

    const [eventRequest, ...performanceRequests] = pocketbaseBatchApi.requests
    expect(created.id).toMatch(/^[a-z0-9]{15}$/)
    expect(eventRequest.data).toMatchObject({ id: created.id })
    expect(performanceRequests).toHaveLength(3)
    for (const request of performanceRequests) {
      expect(request.data).toMatchObject({ eventId: created.id })
      expect(request.id).toMatch(/^[a-z0-9]{15}$/)
    }
    // Entry order survives the write, and the returned event carries the same
    // ids the batch submitted.
    expect(performanceRequests.map((request) => request.data?.artistName)).toEqual([
      'Daft Punk',
      'Justice',
      'Air',
    ])
    expect(created.performances.map((performance) => performance.id)).toEqual(
      performanceRequests.map((request) => request.id),
    )
    expect(created.performances.map((performance) => performance.eventId)).toEqual([
      created.id,
      created.id,
      created.id,
    ])
  })

  it('refuses a save over the configured request bound before sending anything', async () => {
    const repository = new PocketBaseEventsRepository()
    // One event write plus one row per performance: exactly one request over
    // the bound.
    const input = eventInput({ performances: manyPerformances(BATCH_MAX_REQUESTS) })

    const error = await repository.create(input).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FavoritesRepositoryError)
    expect((error as FavoritesRepositoryError).code).toBe('batch_too_large')
    expect(mockPocketbase.createBatch).not.toHaveBeenCalled()
    expect(pocketbaseBatchApi.send).not.toHaveBeenCalled()
    expect(pocketbaseBatchApi.requests).toEqual([])
  })

  it('counts the deletes an update implies against the request bound', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue(
      Array.from({ length: 30 }, (unused, index) =>
        serverPerformance({ id: `stored-${index}`, artistId: `artist-${index}` }),
      ),
    )

    // 1 event update + 25 row creates + 30 row deletes = 56 requests.
    const error = await repository
      .update('event-1', eventInput({ performances: manyPerformances(25) }))
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FavoritesRepositoryError)
    expect((error as FavoritesRepositoryError).code).toBe('batch_too_large')
    expect(pocketbaseBatchApi.send).not.toHaveBeenCalled()
  })

  it('leaves no event and no row behind when the server rejects mid-batch', async () => {
    const repository = new PocketBaseEventsRepository()
    const rejection = {
      status: 400,
      message: 'Batch transaction failed.',
      response: {
        data: { requests: { '2': { code: 'batch_request_failed' } } },
      },
    }
    pocketbaseBatchApi.send.mockRejectedValue(rejection)

    const error = await repository.create(eventInput()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FavoritesRepositoryError)
    expect((error as FavoritesRepositoryError).code).toBe('write_failed')
    expect((error as FavoritesRepositoryError).cause).toBe(rejection)
    // The batch was the only write attempted, so the rolled-back transaction
    // is the whole story: no stray event and no stray row to clean up (AE8).
    expect(pocketbaseEventsCollectionApi.create).not.toHaveBeenCalled()
    expect(pocketbaseEventsCollectionApi.delete).not.toHaveBeenCalled()
    expect(pocketbasePerformancesCollectionApi.create).not.toHaveBeenCalled()
    expect(pocketbasePerformancesCollectionApi.delete).not.toHaveBeenCalled()
  })

  it('maps a disabled batch endpoint to its own error naming the migration', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseBatchApi.send.mockRejectedValue({
      status: 403,
      message: 'Batch requests are not allowed.',
      response: { status: 403, message: 'Batch requests are not allowed.', data: {} },
    })

    const error = await repository.create(eventInput()).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FavoritesRepositoryError)
    expect((error as FavoritesRepositoryError).code).toBe('batch_unavailable')
    expect((error as Error).message).toContain(BATCH_MIGRATION)
  })

  it('packs the update, the create and the deletes of one save into a single batch', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([
      serverPerformance({ id: 'stored-1', artistId: 'artist-1', artistName: 'Daft Punk' }),
      serverPerformance({
        id: 'stored-2',
        artistId: 'artist-2',
        artistName: 'Justice',
        verdict: '',
      }),
      serverPerformance({ id: 'stored-3', artistId: 'artist-3', artistName: 'Air' }),
    ])

    const updated = await repository.update('event-1', {
      name: 'Nuits Sonores 2026',
      dateAttended: '2026-05-15',
      venue: 'Halle Tony Garnier',
      performances: [
        { id: 'stored-2', artistId: 'artist-2', artistName: 'Justice', verdict: 'two-stars' },
        { artistId: 'artist-9', artistName: 'Sebastian', verdict: null },
      ],
    })

    expect(mockPocketbase.createBatch).toHaveBeenCalledTimes(1)
    expect(pocketbaseBatchApi.send).toHaveBeenCalledTimes(1)
    expect(
      pocketbaseBatchApi.requests.map((request) => ({
        method: request.method,
        collection: request.collection,
        id: request.id,
      })),
    ).toEqual([
      { method: 'update', collection: 'events', id: 'event-1' },
      { method: 'update', collection: 'performances', id: 'stored-2' },
      { method: 'create', collection: 'performances', id: updated.performances[1].id },
      { method: 'delete', collection: 'performances', id: 'stored-1' },
      { method: 'delete', collection: 'performances', id: 'stored-3' },
    ])

    // The matched row keeps its id and is edited in place; the input with no id
    // gets a freshly minted one; both stay in entry order.
    expect(updated.performances.map((performance) => performance.artistName)).toEqual([
      'Justice',
      'Sebastian',
    ])
    expect(updated.performances[0].id).toBe('stored-2')
    expect(updated.performances[1].id).toMatch(/^[a-z0-9]{15}$/)
    expect(updated.performances[1].eventId).toBe('event-1')
    expect(updated).toMatchObject({
      id: 'event-1',
      name: 'Nuits Sonores 2026',
      dateAttended: '2026-05-15',
      venue: 'Halle Tony Garnier',
    })
  })

  it('reads an unrated performance back as a null verdict, not an empty string', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([
      serverPerformance({ id: 'performance-1', verdict: '' }),
      serverPerformance({ id: 'performance-2', verdict: 'one-star' }),
    ])

    const [event] = await repository.list()

    expect(event.performances[0].verdict).toBeNull()
    expect(event.performances[1].verdict).toBe('one-star')
  })

  it('normalises the date the server returns to the bare day', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([
      serverEvent({ dateAttended: '2026-05-04 00:00:00.000Z' }),
    ])

    const [event] = await repository.list()

    expect(event.dateAttended).toBe('2026-05-04')
  })

  it('asks the server for the performance list in an explicit, deterministic order', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])

    await repository.list()

    // The list endpoint guarantees no order of its own, so the sort has to be
    // asked for -- and it has to lead on position, because a batch writes every
    // row of one save inside the same millisecond, so `created` ties and the
    // random id would decide the order a line-up reads in (KTD3).
    expect(pocketbasePerformancesCollectionApi.getFullList).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'position,created,id' }),
    )
  })

  it('stamps each row with its index in the submitted line-up on create', async () => {
    const repository = new PocketBaseEventsRepository()

    const created = await repository.create(eventInput())

    const rows = pocketbaseBatchApi.requests.filter(
      (request) => request.collection === 'performances',
    )
    expect(rows.map((request) => (request.data as { position: number }).position)).toEqual([
      0, 1, 2,
    ])
    // The stamped order is the order the caller submitted, not the order the
    // ids happen to sort in.
    expect(rows.map((request) => (request.data as { id: string }).id)).toEqual(
      created.performances.map((performance) => performance.id),
    )
  })

  it('restamps every row on update, because removing one shifts the rest', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([
      serverPerformance({ id: 'stored-1', artistId: 'artist-1', artistName: 'Daft Punk' }),
      serverPerformance({ id: 'stored-2', artistId: 'artist-2', artistName: 'Justice' }),
      serverPerformance({ id: 'stored-3', artistId: 'artist-3', artistName: 'Air' }),
    ])

    // The first stored row is dropped and the survivors swap places, so every
    // remaining row's index changes.
    await repository.update('event-1', {
      name: 'Nuits Sonores 2026',
      dateAttended: '2026-05-15',
      venue: 'Halle Tony Garnier',
      performances: [
        { id: 'stored-3', artistId: 'artist-3', artistName: 'Air', verdict: null },
        { id: 'stored-2', artistId: 'artist-2', artistName: 'Justice', verdict: 'two-stars' },
      ],
    })

    const rows = pocketbaseBatchApi.requests.filter(
      (request) => request.collection === 'performances' && request.method === 'update',
    )
    expect(
      rows.map((request) => ({
        id: request.id,
        position: (request.data as { position: number }).position,
      })),
    ).toEqual([
      { id: 'stored-3', position: 0 },
      { id: 'stored-2', position: 1 },
    ])
  })

  it('reads the same performance order as the cache mirror it feeds', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent()])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([
      serverPerformance({ id: 'performance-a', artistName: 'Daft Punk' }),
      serverPerformance({ id: 'performance-b', artistName: 'Justice', verdict: '' }),
      serverPerformance({ id: 'performance-c', artistName: 'Air', verdict: 'dislike' }),
    ])

    const cloudEvents = await repository.list()

    const cache = new LocalEventsRepository(getEventsStorageKey('google', OWNER_ID))
    await cache.replaceAll(cloudEvents)
    const cachedEvents = await cache.list()

    expect(cachedEvents).toEqual(cloudEvents)
    expect(cachedEvents[0].performances.map((performance) => performance.id)).toEqual([
      'performance-a',
      'performance-b',
      'performance-c',
    ])
  })

  it('drops a performance row whose event is not in the list', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.getFullList.mockResolvedValue([serverEvent({ id: 'event-1' })])
    pocketbasePerformancesCollectionApi.getFullList.mockResolvedValue([
      serverPerformance({ id: 'performance-1', eventId: 'event-1' }),
      serverPerformance({ id: 'performance-orphan', eventId: 'event-gone' }),
    ])

    const events = await repository.list()

    expect(events).toHaveLength(1)
    expect(events[0].performances.map((performance) => performance.id)).toEqual(['performance-1'])
  })

  it('maps a failed read to a read failure', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.getFullList.mockRejectedValue({ status: 500 })

    const error = await repository.list().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FavoritesRepositoryError)
    expect((error as FavoritesRepositoryError).code).toBe('read_failed')
  })

  it('deletes an event with one request and lets the cascade take its rows', async () => {
    const repository = new PocketBaseEventsRepository()

    await repository.delete('event-1')

    expect(pocketbaseEventsCollectionApi.delete).toHaveBeenCalledWith('event-1')
    expect(pocketbasePerformancesCollectionApi.delete).not.toHaveBeenCalled()
    expect(mockPocketbase.createBatch).not.toHaveBeenCalled()
  })

  it('maps a failed delete to a write failure', async () => {
    const repository = new PocketBaseEventsRepository()
    pocketbaseEventsCollectionApi.delete.mockRejectedValue({ status: 404 })

    const error = await repository.delete('event-1').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(FavoritesRepositoryError)
    expect((error as FavoritesRepositoryError).code).toBe('write_failed')
  })
})

describe('selectRepositories in google-cloud mode', () => {
  beforeEach(() => {
    resetLocalStorageMock()
    resetPocketbaseMocks()
  })

  it('serves events from the cloud repository, with the local mirror alongside', () => {
    const selection = selectRepositories({
      authMode: 'google',
      userId: 'user-1',
      backendAvailable: true,
    })

    expect(selection.mode).toBe('google-cloud')
    expect(selection.activeEventsRepository).toBeInstanceOf(PocketBaseEventsRepository)
    // The mirror stays a real local repository, so an online session can still
    // write the cache the offline session reads.
    expect(selection.cacheEventsRepository).toBeInstanceOf(LocalEventsRepository)
  })
})
