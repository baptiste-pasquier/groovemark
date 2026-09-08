import { describe, it, expect } from 'vitest'
import {
  mockPocketbase,
  pocketbaseArtistsCollectionApi,
  pocketbaseCollectionApi,
  resetPocketbaseMocks,
} from './pocketbase'

describe('pocketbase mock', () => {
  it('a response queued for one collection does not satisfy a call to the other', async () => {
    resetPocketbaseMocks()
    pocketbaseCollectionApi.create.mockResolvedValueOnce({ id: 'queued-favorite' })

    const artistsResult = await mockPocketbase.collection('artists').create({})
    expect(artistsResult).not.toEqual({ id: 'queued-favorite' })

    const favoritesResult = await mockPocketbase.collection('favorites').create({})
    expect(favoritesResult).toEqual({ id: 'queued-favorite' })
  })

  it("the reset helper clears both collections' state", async () => {
    resetPocketbaseMocks()
    pocketbaseCollectionApi.create.mockResolvedValueOnce({ id: 'queued-favorite' })
    pocketbaseArtistsCollectionApi.create.mockResolvedValueOnce({ id: 'queued-artist' })

    resetPocketbaseMocks()

    const favoritesResult = await mockPocketbase.collection('favorites').create({})
    const artistsResult = await mockPocketbase.collection('artists').create({})

    expect(favoritesResult).not.toEqual({ id: 'queued-favorite' })
    expect(artistsResult).not.toEqual({ id: 'queued-artist' })
    expect((favoritesResult as { id: string }).id).toBe('mock-id')
    expect((artistsResult as { id: string }).id).toBe('mock-id')
  })
})
