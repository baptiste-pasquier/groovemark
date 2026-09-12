// A verdict is one of four ordered values and nothing else (R3). It is a
// string union rather than a number because it answers "would I go back",
// which is not a quantity worth averaging: the ordering lives in
// VERDICT_ORDER (utils/event.ts) so a sort can rank it without the stored
// value pretending to be a score.
export type Verdict = 'dislike' | 'one-star' | 'two-stars' | 'three-stars'

// A performance as stored: it credits exactly one artist, carries at most one
// verdict, and exists as part of its event and nowhere else (R2, KTD1).
// `artistName` is the credited artist's display name, denormalized so an
// exported event stays readable without the artist records (KTD1).
export interface Performance {
  id: string
  eventId: string
  artistId: string
  artistName: string
  verdict: Verdict | null
}

// A night out: a name, a date attended, a venue, and the performances seen
// there (R1, KTD1). Named MusicEvent rather than Event so importing it never
// shadows the DOM `Event` type inside a component that also handles DOM
// events. `performances` is in entry order, so a line-up reads as it was
// typed (KTD3).
export interface MusicEvent {
  id: string
  name: string
  dateAttended: string
  venue: string
  performances: Performance[]
}

// A performance joined with the context of the event it belongs to, which is
// the shape every per-artist surface reads (KTD12): the artist page lists
// each one with its event, date, venue and verdict (R14).
export interface ArtistPerformance {
  performanceId: string
  eventId: string
  eventName: string
  dateAttended: string
  venue: string
  artistId: string
  artistName: string
  verdict: Verdict | null
}

// What an artist's live history looks like once ordered (R14): every
// performance newest-first, plus the most recent *rated* one, which is what
// both the artist page and the artists table lead with.
export interface ArtistPerformanceHistory {
  performances: ArtistPerformance[]
  latestRated: ArtistPerformance | null
}

// Why an artist has no leading verdict, which AE19 requires the artists table
// to tell apart: 'unrated' means seen live with no verdict on any
// performance, 'unseen' means never seen live at all.
export type VerdictAvailability = 'rated' | 'unrated' | 'unseen'

// The per-artist roll-up the artists table sorts on (R17). `latestRatedVerdict`
// is the most recent *rated* verdict -- the same value the artist page leads
// with -- while `dateLastSeen` follows the most recent performance, rated or
// not, so the two can disagree within one row.
export interface ArtistPerformanceAggregate {
  artistId: string
  performanceCount: number
  verdictAvailability: VerdictAvailability
  latestRatedVerdict: Verdict | null
  latestRatedPerformance: ArtistPerformance | null
  dateLastSeen: string | null
}
