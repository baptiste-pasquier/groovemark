import pb from './pocketbase'
import type { MusicEvent, Performance, Verdict } from '../types/event'
import { BATCH_MAX_REQUESTS, isVerdict, mintRecordId } from '../utils/event'
import type { EventRecordInput, EventsRepository, PerformanceRecordInput } from './eventsRepository'
import { FavoritesRepositoryError } from './favoritesRepository'

const EVENTS_COLLECTION_NAME = 'events'
const PERFORMANCES_COLLECTION_NAME = 'performances'

// The list endpoint promises no order of its own, so one has to be asked for
// (KTD3). It has to be `position`: a batch inserts every row of one save inside
// the same millisecond, `created` has millisecond precision, so rows of a
// line-up tie and the random id decides -- measured against the pinned server,
// a five-row line-up typed 1,2,3,4,5 came back 1,3,4,2,5 under `created,id`.
// `created,id` stays as the tiebreak so rows written before the position field
// existed, which all read as 0, keep a total and stable order among themselves.
const PERFORMANCES_SORT = 'position,created,id'

// Named in the disabled-endpoint message: without this migration /api/batch
// answers 403 and every event save fails, which is otherwise indistinguishable
// from any other write failure (KTD2).
export const BATCH_MIGRATION_NAME = 'pb_migrations/1789067402_enable_batch.js'

interface PocketbaseEvent {
  id: string
  name: string
  dateAttended: string
  venue?: string
  owner?: string
}

interface PocketbasePerformance {
  id: string
  eventId: string
  artistId: string
  artistName: string
  verdict?: string
  position?: number
  owner?: string
}

type BatchHandle = ReturnType<typeof pb.createBatch>

// PocketBase's select field has no null: it normalises an absent verdict to
// '', and returns '' whether the write sent '' or null. Read back as-is, that
// empty string passes the `verdict !== null` test every per-artist surface
// uses, so an unrated performance would lead the artist page and the artists
// tab (R14, AE1). Anything outside the four values maps to null too, rather
// than leaking a value no surface can render.
function toVerdict(value: string | undefined): Verdict | null {
  return isVerdict(value) ? value : null
}

// `dateAttended` is a date field, so the server stores and returns the day the
// modal sent as a full timestamp ('2026-05-04' -> '2026-05-04 00:00:00.000Z'),
// while local mode keeps the bare day the date input gave it. The bare day is
// the interface's canonical form -- there is no time of day to preserve
// (KTD10) -- so the timestamp is cut back to it here, at the read boundary,
// and the same night reads identically in both modes.
function toDayAttended(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : value
}

function toPerformance(record: PocketbasePerformance): Performance {
  return {
    id: record.id,
    eventId: record.eventId,
    artistId: record.artistId,
    artistName: record.artistName,
    verdict: toVerdict(record.verdict),
  }
}

function toEvent(record: PocketbaseEvent, performances: Performance[]): MusicEvent {
  return {
    id: record.id,
    name: record.name,
    dateAttended: toDayAttended(record.dateAttended),
    venue: record.venue ?? '',
    performances,
  }
}

// What one save implies against the rows the event already has: the line-up in
// entry order with every id resolved, which of those ids name a stored row, and
// which stored rows the input dropped. `create` passes no stored ids, so every
// input gets a freshly minted one and nothing is deleted.
interface PerformanceDiff {
  performances: Performance[]
  updatedIds: Set<string>
  deletedIds: string[]
}

function diffPerformances(
  eventId: string,
  inputs: PerformanceRecordInput[],
  storedIds: string[],
): PerformanceDiff {
  const remainingIds = new Set(storedIds)
  const performances: Performance[] = []
  const updatedIds = new Set<string>()

  for (const input of inputs) {
    // An id is kept only while the stored row is still unclaimed, so a
    // duplicated id in one submission mints a second row instead of writing
    // the same row twice -- the same rule LocalEventsRepository follows.
    const keptId = input.id && remainingIds.has(input.id) ? input.id : null
    if (keptId) {
      remainingIds.delete(keptId)
      updatedIds.add(keptId)
    }

    performances.push({
      id: keptId ?? mintRecordId(),
      eventId,
      artistId: input.artistId,
      artistName: input.artistName,
      verdict: input.verdict,
    })
  }

  return { performances, updatedIds, deletedIds: [...remainingIds] }
}

// Refuse before sending rather than receive an opaque rejection: the server
// answers a batch over its request count with a generic failure that names no
// cause, and the operator can act on "too many performances" (KTD2).
function assertWithinBatchBound(requestCount: number) {
  if (requestCount <= BATCH_MAX_REQUESTS) return

  throw new FavoritesRepositoryError(
    `Saving this event needs ${requestCount} batch requests, more than the ${BATCH_MAX_REQUESTS} the server accepts. Split the line-up across two events.`,
    'batch_too_large',
  )
}

// A batch rejected because the endpoint is disabled answers 403 with "Batch
// requests are not allowed."; a row rejected by a rule inside the batch answers
// 400 "Batch transaction failed.". Only the first is a deployment problem, so
// only it gets the code and the message naming the migration.
function isBatchDisabled(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 403
  )
}

// The absent verdict travels as '' rather than null: it is what the select
// field stores either way, so the request body matches the row the server ends
// up holding.
function performanceCreateBody(performance: Performance, position: number) {
  return {
    id: performance.id,
    eventId: performance.eventId,
    artistId: performance.artistId,
    artistName: performance.artistName,
    verdict: performance.verdict ?? '',
    position,
    owner: pb.authStore.model?.id,
  }
}

// An update leaves `eventId` and `owner` unset: the row cannot change event or
// owner, and the update rule only correlates a relation it was actually sent.
// `position` is rewritten on every update, not only on create: removing or
// reordering a row shifts the index of every row after it.
function performanceUpdateBody(performance: Performance, position: number) {
  return {
    artistId: performance.artistId,
    artistName: performance.artistName,
    verdict: performance.verdict ?? '',
    position,
  }
}

export class PocketBaseEventsRepository implements EventsRepository {
  async list(): Promise<MusicEvent[]> {
    try {
      const [eventRecords, performanceRecords] = await Promise.all([
        pb.collection(EVENTS_COLLECTION_NAME).getFullList<PocketbaseEvent>(),
        pb.collection(PERFORMANCES_COLLECTION_NAME).getFullList<PocketbasePerformance>({
          sort: PERFORMANCES_SORT,
        }),
      ])

      const performancesByEvent = new Map<string, Performance[]>(
        eventRecords.map((record) => [record.id, []]),
      )
      for (const record of performanceRecords) {
        // A row whose event is not in the list has nothing to hang off, so it
        // is dropped rather than turned into an event of its own.
        performancesByEvent.get(record.eventId)?.push(toPerformance(record))
      }

      return eventRecords.map((record) => toEvent(record, performancesByEvent.get(record.id) ?? []))
    } catch (error) {
      console.error('Error fetching events from PocketBase:', error)
      throw new FavoritesRepositoryError('Could not load events from PocketBase.', 'read_failed', {
        cause: error,
      })
    }
  }

  async create(input: EventRecordInput): Promise<MusicEvent> {
    // The event id is minted here, before anything is sent, because a batch is
    // one array the client builds whole: no request in it can reference an id
    // the server would assign to an earlier request (KTD13).
    const eventId = mintRecordId()
    const diff = diffPerformances(eventId, input.performances, [])

    assertWithinBatchBound(1 + diff.performances.length)

    const batch = pb.createBatch()
    batch.collection(EVENTS_COLLECTION_NAME).create({
      id: eventId,
      name: input.name,
      dateAttended: input.dateAttended,
      venue: input.venue,
      owner: pb.authStore.model?.id,
    })
    diff.performances.forEach((performance, position) => {
      batch
        .collection(PERFORMANCES_COLLECTION_NAME)
        .create(performanceCreateBody(performance, position))
    })

    await this.send(batch, 'Could not save the event in PocketBase.')

    return {
      id: eventId,
      name: input.name,
      dateAttended: toDayAttended(input.dateAttended),
      venue: input.venue,
      performances: diff.performances,
    }
  }

  async update(id: string, input: EventRecordInput): Promise<MusicEvent> {
    const storedIds = await this.listPerformanceIds(id)
    const diff = diffPerformances(id, input.performances, storedIds)

    assertWithinBatchBound(1 + diff.performances.length + diff.deletedIds.length)

    const batch = pb.createBatch()
    batch.collection(EVENTS_COLLECTION_NAME).update(id, {
      name: input.name,
      dateAttended: input.dateAttended,
      venue: input.venue,
    })
    diff.performances.forEach((performance, position) => {
      const rows = batch.collection(PERFORMANCES_COLLECTION_NAME)
      if (diff.updatedIds.has(performance.id)) {
        rows.update(performance.id, performanceUpdateBody(performance, position))
      } else {
        rows.create(performanceCreateBody(performance, position))
      }
    })
    for (const deletedId of diff.deletedIds) {
      batch.collection(PERFORMANCES_COLLECTION_NAME).delete(deletedId)
    }

    await this.send(batch, 'Could not save the event in PocketBase.')

    return {
      id,
      name: input.name,
      dateAttended: toDayAttended(input.dateAttended),
      venue: input.venue,
      performances: diff.performances,
    }
  }

  // No batch: `eventId` cascades, so deleting the event removes its rows in one
  // request and a delete never depends on the batch endpoint being enabled.
  async delete(id: string): Promise<void> {
    try {
      await pb.collection(EVENTS_COLLECTION_NAME).delete(id)
    } catch (error) {
      console.error('Error deleting event from PocketBase:', error)
      throw new FavoritesRepositoryError(
        'Could not delete the event in PocketBase.',
        'write_failed',
        {
          cause: error,
        },
      )
    }
  }

  // The ids of the rows this event already has, which is what turns a submitted
  // line-up into a create/update/delete diff.
  private async listPerformanceIds(eventId: string): Promise<string[]> {
    try {
      const records = await pb
        .collection(PERFORMANCES_COLLECTION_NAME)
        .getFullList<PocketbasePerformance>({
          filter: pb.filter('eventId = {:eventId}', { eventId }),
          sort: PERFORMANCES_SORT,
        })

      return records.map((record) => record.id)
    } catch (error) {
      console.error('Error fetching event performances from PocketBase:', error)
      throw new FavoritesRepositoryError(
        'Could not load the event line-up from PocketBase.',
        'read_failed',
        { cause: error },
      )
    }
  }

  private async send(batch: BatchHandle, writeFailedMessage: string): Promise<void> {
    try {
      await batch.send()
    } catch (error) {
      console.error('Error saving event batch in PocketBase:', error)

      if (isBatchDisabled(error)) {
        throw new FavoritesRepositoryError(
          `The PocketBase batch endpoint is disabled, so an event cannot be saved as a whole. Apply the ${BATCH_MIGRATION_NAME} migration.`,
          'batch_unavailable',
          { cause: error },
        )
      }

      // The batch is one transaction: a rejection anywhere in it leaves no
      // event and no row behind, so there is nothing to compensate here (R8).
      throw new FavoritesRepositoryError(writeFailedMessage, 'write_failed', { cause: error })
    }
  }
}
