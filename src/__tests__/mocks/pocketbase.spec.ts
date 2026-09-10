import { describe, it, expect } from 'vitest'
import {
  mockPocketbase,
  pocketbaseArtistsCollectionApi,
  pocketbaseBatchApi,
  pocketbaseCollectionApi,
  pocketbaseEventsCollectionApi,
  pocketbasePerformancesCollectionApi,
  resetPocketbaseMocks,
} from './pocketbase'

// Every collection this codebase touches. The double falls through to the
// favorites handle for a name it does not know, so an unrouted collection
// would give a spec a double that is silently shared with favorites: queued
// responses would leak across collections and assertions would pass while
// proving nothing. Listing the names here is what makes that fail loudly.
const ROUTED_COLLECTIONS = ['favorites', 'artists', 'events', 'performances'] as const

describe('pocketbase mock', () => {
  it('gives every routed collection its own handle', () => {
    resetPocketbaseMocks()

    const handles = ROUTED_COLLECTIONS.map((name) => mockPocketbase.collection(name))

    expect(new Set(handles).size).toBe(ROUTED_COLLECTIONS.length)
  })

  it('a response queued for one collection does not satisfy a call to any other', async () => {
    for (const name of ROUTED_COLLECTIONS) {
      resetPocketbaseMocks()
      mockPocketbase.collection(name).create.mockResolvedValueOnce({ id: `queued-${name}` })

      for (const otherName of ROUTED_COLLECTIONS) {
        if (otherName === name) continue
        const otherResult = await mockPocketbase.collection(otherName).create({})
        expect(otherResult).not.toEqual({ id: `queued-${name}` })
      }

      const result = await mockPocketbase.collection(name).create({})
      expect(result).toEqual({ id: `queued-${name}` })
    }
  })

  it("the reset helper clears every collection's state", async () => {
    resetPocketbaseMocks()
    pocketbaseCollectionApi.create.mockResolvedValueOnce({ id: 'queued-favorite' })
    pocketbaseArtistsCollectionApi.create.mockResolvedValueOnce({ id: 'queued-artist' })
    pocketbaseEventsCollectionApi.create.mockResolvedValueOnce({ id: 'queued-event' })
    pocketbasePerformancesCollectionApi.create.mockResolvedValueOnce({ id: 'queued-performance' })

    resetPocketbaseMocks()

    for (const name of ROUTED_COLLECTIONS) {
      const result = await mockPocketbase.collection(name).create({})
      expect((result as { id: string }).id).toBe('mock-id')
    }
  })

  it('records batch requests per batch and resets them', async () => {
    resetPocketbaseMocks()

    const batch = mockPocketbase.createBatch()
    batch.collection('events').create({ id: 'event-1', name: 'Nuits Sonores' })
    batch.collection('performances').delete('performance-1')
    const results = await batch.send()

    expect(pocketbaseBatchApi.requests).toEqual([
      {
        method: 'create',
        collection: 'events',
        id: 'event-1',
        data: { id: 'event-1', name: 'Nuits Sonores' },
      },
      { method: 'delete', collection: 'performances', id: 'performance-1' },
    ])
    expect(results).toHaveLength(2)

    // A second batch starts from an empty log, so one spec's assertions never
    // read another save's requests.
    mockPocketbase.createBatch()
    expect(pocketbaseBatchApi.requests).toEqual([])
  })
})
