import type { MusicEvent, Verdict } from '../types/event'

// A performance as a surface submits it, before it is a stored row (R2).
// `id` names a row the event already has: present and known, the row keeps its
// id and is edited in place; absent, a new row is minted. `create` has nothing
// to preserve, so it mints an id for every performance it is given.
export interface PerformanceRecordInput {
  id?: string
  artistId: string
  artistName: string
  verdict: Verdict | null
}

// A whole event, its line-up included. Every write travels as one of these, so
// no caller ever assembles a performance row itself and an event saves or fails
// as a whole (R8, KTD3). `performances` is the line-up the operator sees, in
// full: `update` treats it as the complete list, minting a row for each input
// without a known id and dropping every stored row the input omits.
export interface EventRecordInput {
  name: string
  dateAttended: string
  venue: string
  performances: PerformanceRecordInput[]
}

// The events port both modes implement. It speaks only in whole events, and it
// fixes the within-event order of `performances` as **entry order** -- the
// order they were submitted in -- in every mode (KTD3). Local storage gives
// that for free; the cloud repository sorts explicitly to reproduce it.
// Across events the order is unspecified: ordering by date attended belongs to
// the store (R11).
export interface EventsRepository {
  list(): Promise<MusicEvent[]>
  create(input: EventRecordInput): Promise<MusicEvent>
  update(id: string, input: EventRecordInput): Promise<MusicEvent>
  delete(id: string): Promise<void>
}
