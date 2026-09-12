import { describe, it, expect } from 'vitest'
import {
  VERDICT_ORDER,
  BATCH_MAX_REQUESTS,
  BATCH_TIMEOUT_SECONDS,
  verdictRank,
  compareVerdicts,
  selectArtistPerformanceHistory,
  emptyArtistPerformanceAggregate,
  aggregateArtistPerformances,
  mintRecordId,
  formatDayAttended,
} from '../utils/event'
import type { ArtistPerformance, Verdict } from '../types/event'

// Build a joined per-artist performance, so each test states only what it
// cares about (the date, the verdict, the id used by the tiebreak).
function performance(overrides: Partial<ArtistPerformance> = {}): ArtistPerformance {
  return {
    performanceId: 'p1',
    eventId: 'e1',
    eventName: 'Nuits Sonores',
    dateAttended: '2026-05-01 20:00:00.000Z',
    venue: 'Les Subsistances',
    artistId: 'a1',
    artistName: 'Daft Punk',
    verdict: null,
    ...overrides,
  }
}

describe('event utils', () => {
  describe('verdict ordering', () => {
    it('ranks dislike lowest, one star above it and three stars highest', () => {
      expect(VERDICT_ORDER.dislike).toBeLessThan(VERDICT_ORDER['one-star'])
      expect(VERDICT_ORDER['one-star']).toBeLessThan(VERDICT_ORDER['two-stars'])
      expect(VERDICT_ORDER['two-stars']).toBeLessThan(VERDICT_ORDER['three-stars'])

      const ranked = (['two-stars', 'dislike', 'three-stars', 'one-star'] as Verdict[]).sort(
        (a, b) => compareVerdicts(a, b),
      )
      expect(ranked).toEqual(['dislike', 'one-star', 'two-stars', 'three-stars'])
    })

    // R3/R4: the absent verdict is not a fifth, lowest value on the scale --
    // it sits outside the ranking, so it has no rank at all.
    it('places the absent verdict outside the ranking rather than below dislike', () => {
      expect(verdictRank('dislike')).toBe(VERDICT_ORDER.dislike)
      expect(verdictRank(null)).toBeNull()
    })

    it('groups the absent verdict after every rated value when sorting ascending', () => {
      const sorted = ([null, 'three-stars', null, 'dislike'] as (Verdict | null)[]).sort((a, b) =>
        compareVerdicts(a, b),
      )
      expect(sorted).toEqual(['dislike', 'three-stars', null, null])
      expect(compareVerdicts(null, null)).toBe(0)
    })
  })

  describe('selectArtistPerformanceHistory', () => {
    // AE1: the most recent night is unrated, so the leading verdict comes from
    // the rated night before it, with that earlier date.
    it('skips an unrated latest performance and returns the rated one before it, with its date', () => {
      const latest = performance({
        performanceId: 'p-latest',
        dateAttended: '2026-06-20 21:00:00.000Z',
        verdict: null,
      })
      const earlier = performance({
        performanceId: 'p-earlier',
        dateAttended: '2026-03-14 21:00:00.000Z',
        verdict: 'two-stars',
      })

      const history = selectArtistPerformanceHistory([earlier, latest])

      expect(history.latestRated).toEqual(earlier)
      expect(history.latestRated?.verdict).toBe('two-stars')
      expect(history.latestRated?.dateAttended).toBe('2026-03-14 21:00:00.000Z')
      expect(history.performances).toEqual([latest, earlier])
    })

    it('orders every performance newest-first regardless of input order', () => {
      const oldest = performance({ performanceId: 'p1', dateAttended: '2024-01-01 20:00:00.000Z' })
      const middle = performance({ performanceId: 'p2', dateAttended: '2025-01-01 20:00:00.000Z' })
      const newest = performance({ performanceId: 'p3', dateAttended: '2026-01-01 20:00:00.000Z' })

      const history = selectArtistPerformanceHistory([middle, oldest, newest])

      expect(history.performances.map((p) => p.performanceId)).toEqual(['p3', 'p2', 'p1'])
    })

    it('does not mutate the array it is given', () => {
      const input = [
        performance({ performanceId: 'p1', dateAttended: '2024-01-01 20:00:00.000Z' }),
        performance({ performanceId: 'p2', dateAttended: '2026-01-01 20:00:00.000Z' }),
      ]

      selectArtistPerformanceHistory(input)

      expect(input.map((p) => p.performanceId)).toEqual(['p1', 'p2'])
    })

    // AE3: no verdict anywhere means no leading verdict, and the full list is
    // still handed back so the page can list every performance.
    it('returns no latest rated performance when none is rated, and still returns the full list', () => {
      const history = selectArtistPerformanceHistory([
        performance({ performanceId: 'p1', dateAttended: '2026-01-01 20:00:00.000Z' }),
        performance({ performanceId: 'p2', dateAttended: '2026-02-01 20:00:00.000Z' }),
      ])

      expect(history.latestRated).toBeNull()
      expect(history.performances.map((p) => p.performanceId)).toEqual(['p2', 'p1'])
    })

    it('returns nothing when the artist has no performance at all', () => {
      const history = selectArtistPerformanceHistory([])

      expect(history.latestRated).toBeNull()
      expect(history.performances).toEqual([])
    })

    // Two performances on the same date must not order by array position:
    // the stated tiebreak is performance id ascending.
    it('orders performances sharing one date by performance id, not by array position', () => {
      const first = performance({ performanceId: 'aaa', verdict: 'dislike' })
      const second = performance({ performanceId: 'bbb', verdict: 'three-stars' })

      const forward = selectArtistPerformanceHistory([first, second])
      const reversed = selectArtistPerformanceHistory([second, first])

      expect(forward.performances.map((p) => p.performanceId)).toEqual(['aaa', 'bbb'])
      expect(reversed.performances.map((p) => p.performanceId)).toEqual(['aaa', 'bbb'])
      expect(forward.latestRated?.performanceId).toBe('aaa')
      expect(reversed.latestRated?.performanceId).toBe('aaa')
    })
  })

  describe('aggregateArtistPerformances', () => {
    it('counts an artist performances and reports the rated verdict and the date last seen', () => {
      const aggregates = aggregateArtistPerformances([
        performance({
          performanceId: 'p1',
          dateAttended: '2026-03-14 21:00:00.000Z',
          verdict: 'two-stars',
        }),
        performance({
          performanceId: 'p2',
          dateAttended: '2026-06-20 21:00:00.000Z',
          verdict: 'three-stars',
        }),
      ])

      const aggregate = aggregates.get('a1')
      expect(aggregate?.performanceCount).toBe(2)
      expect(aggregate?.verdictAvailability).toBe('rated')
      expect(aggregate?.latestRatedVerdict).toBe('three-stars')
      expect(aggregate?.dateLastSeen).toBe('2026-06-20 21:00:00.000Z')
    })

    it('groups performances by the artist they credit', () => {
      const aggregates = aggregateArtistPerformances([
        performance({ performanceId: 'p1', artistId: 'a1', verdict: 'dislike' }),
        performance({ performanceId: 'p2', artistId: 'a2', verdict: 'three-stars' }),
        performance({ performanceId: 'p3', artistId: 'a2', verdict: null }),
      ])

      expect(aggregates.get('a1')?.performanceCount).toBe(1)
      expect(aggregates.get('a2')?.performanceCount).toBe(2)
      expect(aggregates.get('a1')?.latestRatedVerdict).toBe('dislike')
      expect(aggregates.get('a2')?.latestRatedVerdict).toBe('three-stars')
    })

    // AE14: the table's column and the artist page read the same value,
    // because the aggregate reads the page's own selector.
    it('reports the same verdict the page selector reports over the same performances', () => {
      const performances = [
        performance({
          performanceId: 'p1',
          dateAttended: '2026-03-14 21:00:00.000Z',
          verdict: 'two-stars',
        }),
        performance({
          performanceId: 'p2',
          dateAttended: '2026-06-20 21:00:00.000Z',
          verdict: null,
        }),
      ]

      const history = selectArtistPerformanceHistory(performances)
      const aggregate = aggregateArtistPerformances(performances).get('a1')

      expect(aggregate?.latestRatedVerdict).toBe(history.latestRated?.verdict)
      expect(aggregate?.latestRatedPerformance).toEqual(history.latestRated)
      expect(aggregate?.latestRatedVerdict).toBe('two-stars')
    })

    // AE14: within one row the date and the verdict may disagree -- the date
    // follows the latest performance, the verdict the latest rated one.
    it('reports the latest performance as the date last seen while the verdict comes from an earlier night', () => {
      const aggregate = aggregateArtistPerformances([
        performance({
          performanceId: 'p1',
          dateAttended: '2026-03-14 21:00:00.000Z',
          verdict: 'two-stars',
        }),
        performance({
          performanceId: 'p2',
          dateAttended: '2026-06-20 21:00:00.000Z',
          verdict: null,
        }),
      ]).get('a1')

      expect(aggregate?.dateLastSeen).toBe('2026-06-20 21:00:00.000Z')
      expect(aggregate?.latestRatedPerformance?.dateAttended).toBe('2026-03-14 21:00:00.000Z')
      expect(aggregate?.latestRatedVerdict).toBe('two-stars')
    })

    // AE19: seen live with no verdict anywhere reports unrated, which is not
    // the same as never having been seen live.
    it('reports unrated for an artist whose performances carry no verdict at all', () => {
      const aggregate = aggregateArtistPerformances([
        performance({ performanceId: 'p1', dateAttended: '2026-01-01 20:00:00.000Z' }),
        performance({ performanceId: 'p2', dateAttended: '2026-02-01 20:00:00.000Z' }),
      ]).get('a1')

      expect(aggregate?.verdictAvailability).toBe('unrated')
      expect(aggregate?.latestRatedVerdict).toBeNull()
      expect(aggregate?.latestRatedPerformance).toBeNull()
      expect(aggregate?.performanceCount).toBe(2)
      expect(aggregate?.dateLastSeen).toBe('2026-02-01 20:00:00.000Z')
    })

    // AE19, second half: an artist with no performance is absent from the map,
    // and the empty aggregate reports the absent case rather than unrated.
    it('reports the absent case for an artist with no performance', () => {
      const aggregates = aggregateArtistPerformances([
        performance({ artistId: 'a1', verdict: 'dislike' }),
      ])
      expect(aggregates.has('a2')).toBe(false)

      const absent = emptyArtistPerformanceAggregate('a2')
      expect(absent.artistId).toBe('a2')
      expect(absent.verdictAvailability).toBe('unseen')
      expect(absent.performanceCount).toBe(0)
      expect(absent.latestRatedVerdict).toBeNull()
      expect(absent.dateLastSeen).toBeNull()
    })

    it('picks the latest of two performances tied on date by the stated tiebreak, not by array position', () => {
      const early = performance({ performanceId: 'aaa', verdict: 'dislike' })
      const late = performance({ performanceId: 'bbb', verdict: 'three-stars' })

      const forward = aggregateArtistPerformances([early, late]).get('a1')
      const reversed = aggregateArtistPerformances([late, early]).get('a1')

      // Performance id ascending: 'aaa' is the latest of the tied pair.
      expect(forward?.latestRatedVerdict).toBe('dislike')
      expect(reversed?.latestRatedVerdict).toBe('dislike')
      expect(forward?.latestRatedPerformance?.performanceId).toBe('aaa')
      expect(reversed?.latestRatedPerformance?.performanceId).toBe('aaa')
    })

    it('returns an empty map for no performances at all', () => {
      expect(aggregateArtistPerformances([]).size).toBe(0)
    })
  })

  describe('mintRecordId', () => {
    // KTD13: PocketBase rejects an id that is not exactly fifteen characters
    // matching ^[a-z0-9]+$, so enough draws to catch a short, padded or
    // out-of-alphabet id.
    it('mints an id of exactly fifteen lowercase alphanumeric characters', () => {
      const ids = new Set<string>()
      for (let draw = 0; draw < 500; draw += 1) {
        const id = mintRecordId()
        expect(id).toMatch(/^[a-z0-9]{15}$/)
        ids.add(id)
      }
      expect(ids.size).toBe(500)
    })
  })

  describe('batch bounds', () => {
    // KTD2: the client cannot read these back from the server, so the
    // migration test and the repository guard agree by reading them here.
    it('exports the request count and transaction timeout the migration writes', () => {
      expect(BATCH_MAX_REQUESTS).toBe(50)
      expect(BATCH_TIMEOUT_SECONDS).toBe(3)
    })
  })
})

describe('formatDayAttended', () => {
  it('prints the stored day in the reader locale', () => {
    expect(formatDayAttended('2026-07-12', 'fr')).toBe('12 juillet 2026')
    expect(formatDayAttended('2026-07-12', 'en')).toBe('July 12, 2026')
  })

  // `new Date('2026-05-04')` is midnight UTC, so formatting it in a zone west
  // of UTC prints 3 May. Formatting in UTC is what keeps the day it was typed.
  it('does not shift the day for a reader west of UTC', () => {
    const shifted = new Intl.DateTimeFormat('fr', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    }).format(new Date('2026-05-04'))
    expect(shifted).toBe('3 mai 2026')

    expect(formatDayAttended('2026-05-04', 'fr')).toBe('4 mai 2026')
  })

  it('returns anything that is not a bare day unchanged', () => {
    expect(formatDayAttended('', 'fr')).toBe('')
    expect(formatDayAttended('2026-05-04 00:00:00.000Z', 'fr')).toBe('2026-05-04 00:00:00.000Z')
  })
})
