import type { MusicEvent, Performance } from '../types/event'
import { mintRecordId } from '../utils/event'
import { createWriteQueue, readStorage, writeStorageOrThrow } from './storage'
import type { EventRecordInput, EventsRepository, PerformanceRecordInput } from './eventsRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

// Cache data written by hand, or by a shape older than the nested performances
// list, can arrive without the array. Defaulting it here, at the read
// boundary, keeps every `performances` access downstream safe without the same
// guard scattered through the stores and the UI.
function normalizeStoredEvent(event: MusicEvent): MusicEvent {
  return event.performances ? event : { ...event, performances: [] }
}

function buildPerformance(
  eventId: string,
  input: PerformanceRecordInput,
  storedPerformances: Map<string, Performance>,
): Performance {
  // An input carrying the id of a row this event already has keeps that id, so
  // editing one verdict rewrites one row instead of re-minting the line-up.
  // The row is consumed from the map, so a duplicated id in one submission
  // mints a second row rather than colliding with the first.
  const storedPerformance = input.id ? storedPerformances.get(input.id) : undefined
  if (storedPerformance) {
    storedPerformances.delete(storedPerformance.id)
  }

  return {
    id: storedPerformance?.id ?? mintRecordId(),
    eventId,
    artistId: input.artistId,
    artistName: input.artistName,
    verdict: input.verdict,
  }
}

// The stored event an input describes. Performances follow the input's order,
// which is the entry order the interface promises (KTD3), and a stored row the
// input omits is simply absent from the result -- which is how a removal
// reaches storage.
function buildEvent(
  id: string,
  input: EventRecordInput,
  storedPerformances: Map<string, Performance>,
): MusicEvent {
  return {
    id,
    name: input.name,
    dateAttended: input.dateAttended,
    venue: input.venue,
    performances: input.performances.map((performance) =>
      buildPerformance(id, performance, storedPerformances),
    ),
  }
}

export class LocalEventsRepository implements EventsRepository {
  private storageKey: string
  // KTD3 stores every event under one key, so a save is list -> mutate ->
  // rewrite-all: two saves racing between the read and the write would drop a
  // whole night, not just a field. LocalFavoritesRepository has no such queue,
  // so taking the shared one here is a deliberate choice rather than an
  // inherited one.
  private enqueue = createWriteQueue()

  constructor(storageKey: string) {
    this.storageKey = storageKey
  }

  async list(): Promise<MusicEvent[]> {
    const events = readStorage<MusicEvent[]>(this.storageKey)
    return events ? events.map(normalizeStoredEvent) : []
  }

  async create(input: EventRecordInput): Promise<MusicEvent> {
    return this.enqueue(async () => {
      const events = await this.list()
      const createdEvent = buildEvent(mintRecordId(), input, new Map())
      events.push(createdEvent)
      this.persist(events)
      return createdEvent
    })
  }

  async update(id: string, input: EventRecordInput): Promise<MusicEvent> {
    return this.enqueue(async () => {
      const events = await this.list()
      const storedEvent = events.find((event) => event.id === id)

      if (!storedEvent) {
        throw new FavoritesRepositoryError('Event not found.', 'write_failed')
      }

      const updatedEvent = buildEvent(
        id,
        input,
        new Map(storedEvent.performances.map((performance) => [performance.id, performance])),
      )
      this.persist(events.map((event) => (event.id === id ? updatedEvent : event)))
      return updatedEvent
    })
  }

  async delete(id: string): Promise<void> {
    return this.enqueue(async () => {
      const events = await this.list()
      this.persist(events.filter((event) => event.id !== id))
    })
  }

  // The cache-mirror entry point: whole events, performances already nested, so
  // no mirroring, export or import path ever handles a performance row (KTD3).
  // Queued like every other write, so a mirror landing mid-session cannot
  // interleave with a save.
  async replaceAll(events: MusicEvent[]): Promise<void> {
    return this.enqueue(async () => {
      this.persist(events)
    })
  }

  // Writes through the throwing helper rather than the swallowing one: under
  // KTD3 the key holds every event and is rewritten whole, so a refused write
  // discards the night just typed. The caller has to hear about that instead of
  // finding a log line after the modal closed.
  private persist(events: MusicEvent[]) {
    try {
      writeStorageOrThrow(this.storageKey, events)
    } catch (error) {
      console.error(`Error persisting events to storage key "${this.storageKey}":`, error)
      throw new FavoritesRepositoryError(
        'Could not save the event on this device.',
        'write_failed',
        { cause: error },
      )
    }
  }
}
