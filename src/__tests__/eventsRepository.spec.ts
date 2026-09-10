import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalArtistsRepository } from '../services/localArtistsRepository'
import { LocalEventsRepository } from '../services/localEventsRepository'
import { FavoritesRepositoryError, selectRepositories } from '../services/favoritesRepository'
import type { EventRecordInput, PerformanceRecordInput } from '../services/eventsRepository'
import { getArtistsStorageKey, getEventsStorageKey } from '../services/storage'
import type { MusicEvent, Performance } from '../types/event'
import { getLocalStorageState, localStorageMock, resetLocalStorageMock } from './mocks/localStorage'

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

// The shape a surface hands back when it re-submits a performance it did not
// change: the stored row, minus the fields the repository owns.
function toInput(performance: Performance): PerformanceRecordInput {
  return {
    id: performance.id,
    artistId: performance.artistId,
    artistName: performance.artistName,
    verdict: performance.verdict,
  }
}

function toEventInput(event: MusicEvent, performances: PerformanceRecordInput[]): EventRecordInput {
  return {
    name: event.name,
    dateAttended: event.dateAttended,
    venue: event.venue,
    performances,
  }
}

describe('LocalEventsRepository', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  it('persists every performance of a new event and reads them back in entry order', async () => {
    const storageKey = getEventsStorageKey('local')
    const repository = new LocalEventsRepository(storageKey)

    const created = await repository.create(eventInput())

    expect(created.performances.map((performance) => performance.artistName)).toEqual([
      'Daft Punk',
      'Justice',
      'Air',
    ])
    expect(created.performances.map((performance) => performance.eventId)).toEqual([
      created.id,
      created.id,
      created.id,
    ])
    for (const id of [created.id, ...created.performances.map((performance) => performance.id)]) {
      expect(id).toMatch(/^[a-z0-9]{15}$/)
    }

    const events = await repository.list()
    expect(events).toEqual([created])
    expect(getLocalStorageState()[storageKey]).toBe(JSON.stringify([created]))
  })

  it('edits one verdict without touching its siblings or the event fields', async () => {
    const repository = new LocalEventsRepository(getEventsStorageKey('local'))
    const created = await repository.create(eventInput())

    const updated = await repository.update(
      created.id,
      toEventInput(
        created,
        created.performances.map((performance, index) =>
          index === 1 ? { ...toInput(performance), verdict: 'one-star' } : toInput(performance),
        ),
      ),
    )

    expect(updated.performances.map((performance) => performance.id)).toEqual(
      created.performances.map((performance) => performance.id),
    )
    expect(updated.performances[1]).toEqual({ ...created.performances[1], verdict: 'one-star' })
    expect(updated.performances[0]).toEqual(created.performances[0])
    expect(updated.performances[2]).toEqual(created.performances[2])
    expect({
      id: updated.id,
      name: updated.name,
      dateAttended: updated.dateAttended,
      venue: updated.venue,
    }).toEqual({
      id: created.id,
      name: created.name,
      dateAttended: created.dateAttended,
      venue: created.venue,
    })

    const events = await repository.list()
    expect(events).toEqual([updated])
  })

  it('removes one performance and leaves its siblings in place', async () => {
    const repository = new LocalEventsRepository(getEventsStorageKey('local'))
    const created = await repository.create(eventInput())
    const [first, removed, third] = created.performances

    const updated = await repository.update(
      created.id,
      toEventInput(created, [toInput(first), toInput(third)]),
    )

    expect(updated.performances).toEqual([first, third])
    expect(updated.performances.some((performance) => performance.id === removed.id)).toBe(false)

    const events = await repository.list()
    expect(events).toEqual([updated])
  })

  it('adds a performance to a saved event without re-minting the existing rows', async () => {
    const repository = new LocalEventsRepository(getEventsStorageKey('local'))
    const created = await repository.create(eventInput())

    const updated = await repository.update(
      created.id,
      toEventInput(created, [
        ...created.performances.map(toInput),
        { artistId: 'artist-4', artistName: 'Cassius', verdict: 'two-stars' },
      ]),
    )

    expect(updated.performances.slice(0, 3)).toEqual(created.performances)
    expect(updated.performances[3]).toEqual({
      id: expect.stringMatching(/^[a-z0-9]{15}$/),
      eventId: created.id,
      artistId: 'artist-4',
      artistName: 'Cassius',
      verdict: 'two-stars',
    })
  })

  it('deletes an event together with its performances', async () => {
    const storageKey = getEventsStorageKey('local')
    const repository = new LocalEventsRepository(storageKey)
    const deleted = await repository.create(eventInput({ name: 'Deleted night' }))
    const kept = await repository.create(eventInput({ name: 'Kept night' }))

    await repository.delete(deleted.id)

    const events = await repository.list()
    expect(events).toEqual([kept])

    const stored = getLocalStorageState()[storageKey]
    for (const performance of deleted.performances) {
      expect(stored).not.toContain(performance.id)
    }
    for (const performance of kept.performances) {
      expect(stored).toContain(performance.id)
    }
  })

  it('round-trips through its own storage key and never writes the favorites or artists key', async () => {
    const storageKey = getEventsStorageKey('local')
    expect(storageKey).toBe('groovemark:events:local')
    expect(getEventsStorageKey('google', 'user-1')).toBe('groovemark:events:google:user-1')

    const repository = new LocalEventsRepository(storageKey)
    const created = await repository.create(eventInput())

    expect(Object.keys(getLocalStorageState())).toEqual([storageKey])
    expect(JSON.parse(getLocalStorageState()[storageKey])).toEqual([created])
  })

  it('reports a rejected local write to the caller instead of resolving as though it had persisted', async () => {
    const storageKey = getEventsStorageKey('local')
    const repository = new LocalEventsRepository(storageKey)
    const originalSetItem = localStorageMock.setItem.getMockImplementation()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    let thrown: unknown
    try {
      await repository.create(eventInput())
    } catch (error) {
      thrown = error
    } finally {
      localStorageMock.setItem.mockImplementation(originalSetItem!)
      consoleError.mockRestore()
    }

    expect(thrown).toBeInstanceOf(FavoritesRepositoryError)
    expect((thrown as FavoritesRepositoryError).code).toBe('write_failed')
    expect(getLocalStorageState()[storageKey]).toBeUndefined()
    expect(await repository.list()).toEqual([])

    // The rejected write must not wedge the write queue behind it.
    const retried = await repository.create(eventInput())
    expect(await repository.list()).toEqual([retried])
  })

  it('lands both of two concurrent saves rather than letting one overwrite the other', async () => {
    const repository = new LocalEventsRepository(getEventsStorageKey('local'))

    // Fired without awaiting between them, so both read the same empty
    // storage before either has written -- the race a single-key
    // list -> push -> rewrite loses without a write lock.
    await Promise.all([
      repository.create(eventInput({ name: 'First night' })),
      repository.create(eventInput({ name: 'Second night' })),
    ])

    const events = await repository.list()
    expect(events.map((event) => event.name).sort()).toEqual(['First night', 'Second night'])
    expect(events.map((event) => event.performances.length)).toEqual([3, 3])
  })

  it('replaces every event in one write for the cache mirror', async () => {
    const storageKey = getEventsStorageKey('google', 'user-1')
    const repository = new LocalEventsRepository(storageKey)
    const mirrored: MusicEvent[] = [
      {
        id: 'aaaaaaaaaaaaaaa',
        name: 'Cloud night',
        dateAttended: '2026-04-01',
        venue: 'Le Sucre',
        performances: [
          {
            id: 'bbbbbbbbbbbbbbb',
            eventId: 'aaaaaaaaaaaaaaa',
            artistId: 'artist-9',
            artistName: 'Kavinsky',
            verdict: 'two-stars',
          },
        ],
      },
    ]

    await repository.replaceAll(mirrored)

    expect(await repository.list()).toEqual(mirrored)
    expect(Object.keys(getLocalStorageState())).toEqual([storageKey])
  })
})

describe('selectRepositories with events', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  it('serves local mode from the local events key', async () => {
    const selection = selectRepositories({
      authMode: 'local',
      backendAvailable: false,
    })

    expect(selection.mode).toBe('local')
    expect(selection.activeEventsRepository).toBe(selection.cacheEventsRepository)

    await selection.activeEventsRepository.create(eventInput())
    expect(Object.keys(getLocalStorageState())).toEqual(['groovemark:events:local'])
  })

  it('rejects every events write in cache mode while reads keep working', async () => {
    const selection = selectRepositories({
      authMode: 'google',
      userId: 'user-1',
      backendAvailable: false,
    })

    expect(selection.mode).toBe('google-cache')

    const seeded = await selection.cacheEventsRepository.create(eventInput())
    expect(await selection.activeEventsRepository.list()).toEqual([seeded])
    expect(Object.keys(getLocalStorageState())).toEqual(['groovemark:events:google:user-1'])

    const writes = [
      () => selection.activeEventsRepository.create(eventInput()),
      () => selection.activeEventsRepository.update(seeded.id, eventInput()),
      () => selection.activeEventsRepository.delete(seeded.id),
    ]

    for (const write of writes) {
      let thrown: unknown
      try {
        await write()
      } catch (error) {
        thrown = error
      }

      expect(thrown).toBeInstanceOf(FavoritesRepositoryError)
      expect((thrown as FavoritesRepositoryError).code).toBe('unavailable')
    }

    expect(await selection.activeEventsRepository.list()).toEqual([seeded])
  })
})

// The events repository needed a write helper that propagates, so `writeStorage`
// was rewritten to wrap the new throwing one. Its existing callers still rely on
// the swallow-and-log behaviour, so pin it here: an artists write the browser
// refuses must resolve, log, and leave the key alone.
describe('writeStorage for its existing callers', () => {
  beforeEach(() => {
    resetLocalStorageMock()
  })

  it('still swallows and logs a rejected write instead of throwing', async () => {
    const storageKey = getArtistsStorageKey('local')
    const repository = new LocalArtistsRepository(storageKey)
    const originalSetItem = localStorageMock.setItem.getMockImplementation()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    localStorageMock.setItem.mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    let thrown: unknown
    try {
      await repository.create({ displayName: 'Daft Punk', slug: 'daft-punk' })
    } catch (error) {
      thrown = error
    } finally {
      localStorageMock.setItem.mockImplementation(originalSetItem!)
    }

    expect(thrown).toBeUndefined()
    expect(consoleError).toHaveBeenCalledWith(
      `Error persisting storage key "${storageKey}":`,
      expect.any(DOMException),
    )
    expect(getLocalStorageState()[storageKey]).toBeUndefined()

    consoleError.mockRestore()
  })
})
