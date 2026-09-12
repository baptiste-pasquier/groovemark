import type {
  ArtistPerformance,
  ArtistPerformanceAggregate,
  ArtistPerformanceHistory,
  Verdict,
} from '../types/event'

// The verdict scale, lowest to highest (R3). Exported so a sort can rank a
// verdict without any surface re-stating the order; the numbers are ranks for
// comparison only and are never stored or shown as a score.
export const VERDICT_ORDER: Record<Verdict, number> = {
  dislike: 0,
  'one-star': 1,
  'two-stars': 2,
  'three-stars': 3,
}

// Narrows an untrusted value to a verdict. `value in VERDICT_ORDER` looks like
// the same test and is not: it walks the prototype chain, so '__proto__' and
// 'toString' pass it. Such a value reaches a surface as a verdict no glyph
// exists for and throws inside vue-i18n at render time, taking the events tab
// and the artist page down with no in-app recovery -- so every untrusted
// boundary (the backup file, the cloud read) narrows through this one owner
// rather than keeping its own copy of the four values.
export function isVerdict(value: unknown): value is Verdict {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(VERDICT_ORDER, value)
}

// The accessible name of each verdict, keyed by the verdict itself. No verdict
// name is ever written on screen -- a rated state is a glyph -- so these keys
// are the only place those names exist, and both the display badge and the
// editable picker read them from here rather than each holding a copy that an
// i18n rename could leave behind.
export const VERDICT_ARIA_KEYS: Record<Verdict, string> = {
  dislike: 'verdict.aria.dislike',
  'one-star': 'verdict.aria.one_star',
  'two-stars': 'verdict.aria.two_stars',
  'three-stars': 'verdict.aria.three_stars',
}

// KTD2's two bounds on the batch endpoint. The settings endpoint is
// superuser-only, so the client cannot read these back from the server: the
// repository's refuse-before-send guard and the settings migration's test both
// read them here rather than inlining a literal that would drift silently.
export const BATCH_MAX_REQUESTS = 50
export const BATCH_TIMEOUT_SECONDS = 3

// Alphabet and length PocketBase accepts for a record id: exactly fifteen
// characters matching ^[a-z0-9]+$ (see the created_artists migration).
const RECORD_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const RECORD_ID_LENGTH = 15
// Largest multiple of the alphabet size that fits in a byte (36 * 7). Bytes at
// or above it are rejected rather than folded, so no character is favoured.
const RECORD_ID_BYTE_LIMIT = 252

// Rank a verdict for sorting. The absent verdict has no rank: it is not a
// fifth, lowest step on the scale (R4), so it returns null and a caller
// decides where the unrated rows go.
export function verdictRank(verdict: Verdict | null): number | null {
  return verdict === null ? null : VERDICT_ORDER[verdict]
}

// Ascending comparator over verdicts: rated values in VERDICT_ORDER, then the
// absent verdict as its own group after all of them. Absent is grouped rather
// than ranked, so a surface that wants unrated rows last under a descending
// sort partitions them itself instead of reading a fabricated rank.
export function compareVerdicts(a: Verdict | null, b: Verdict | null): number {
  const rankA = verdictRank(a)
  const rankB = verdictRank(b)
  if (rankA === null || rankB === null) {
    if (rankA === rankB) return 0
    return rankA === null ? 1 : -1
  }
  return rankA - rankB
}

// Order two performances newest-first. Dates are compared as strings, which
// is correct for the lexicographically sortable form PocketBase stores and
// returns. Performances sharing one date break the tie on performance id,
// ascending, which makes this a total order: the result never depends on the
// position a performance happened to hold in the input array.
function compareNewestFirst(a: ArtistPerformance, b: ArtistPerformance): number {
  if (a.dateAttended !== b.dateAttended) return a.dateAttended < b.dateAttended ? 1 : -1
  return a.performanceId < b.performanceId ? -1 : a.performanceId > b.performanceId ? 1 : 0
}

// The artist page's live half (R14): every performance newest-first, plus the
// most recent *rated* one, which is what the page leads with. An unrated
// latest night is skipped for the leading verdict but still listed (AE1), and
// an artist with nothing rated gets no leading verdict and the full list
// anyway (AE3). Pure: does not mutate the array it is given.
export function selectArtistPerformanceHistory(
  performances: ArtistPerformance[],
): ArtistPerformanceHistory {
  const ordered = [...performances].sort(compareNewestFirst)

  return {
    performances: ordered,
    latestRated: ordered.find((performance) => performance.verdict !== null) ?? null,
  }
}

// The aggregate for an artist no performance credits (AE19's second half):
// 'unseen', not 'unrated'. The artists tab lists artists credited by a mix
// alone, so it needs a row shape for a performer never seen live.
export function emptyArtistPerformanceAggregate(artistId: string): ArtistPerformanceAggregate {
  return {
    artistId,
    performanceCount: 0,
    verdictAvailability: 'unseen',
    latestRatedVerdict: null,
    latestRatedPerformance: null,
    dateLastSeen: null,
  }
}

// Roll performances up per artist for the artists tab (R17). The leading
// verdict is read from selectArtistPerformanceHistory rather than derived a
// second time, which is what stops the tab's column and the artist page from
// ever disagreeing (AE14, KTD16). The date last seen follows the most recent
// performance, rated or not, so a row can carry a verdict from an earlier
// night than the date beside it. An artist absent from the returned map has
// no performance at all -- use emptyArtistPerformanceAggregate for that row.
export function aggregateArtistPerformances(
  performances: ArtistPerformance[],
): Map<string, ArtistPerformanceAggregate> {
  const groups = new Map<string, ArtistPerformance[]>()
  for (const performance of performances) {
    const group = groups.get(performance.artistId)
    if (group) {
      group.push(performance)
    } else {
      groups.set(performance.artistId, [performance])
    }
  }

  const aggregates = new Map<string, ArtistPerformanceAggregate>()
  for (const [artistId, group] of groups) {
    const history = selectArtistPerformanceHistory(group)
    aggregates.set(artistId, {
      artistId,
      performanceCount: history.performances.length,
      // Every group holds at least one performance, so the artist was seen:
      // no leading verdict here means unrated, never unseen.
      verdictAvailability: history.latestRated ? 'rated' : 'unrated',
      latestRatedVerdict: history.latestRated?.verdict ?? null,
      latestRatedPerformance: history.latestRated,
      dateLastSeen: history.performances[0]?.dateAttended ?? null,
    })
  }

  return aggregates
}

// Render a date attended for reading. The stored form is the bare day, and
// `new Date('2026-05-04')` parses that as midnight UTC -- so formatting it in a
// zone west of UTC prints the day before. The parts are read explicitly and
// formatted in UTC instead, which keeps the printed day the day that was typed.
// One owner, because the event card, the artist page and the artists table all
// print it (KTD16).
export function formatDayAttended(day: string, locale: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!parts) return day

  const [, year, month, date] = parts
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(date))))
}

// Mint a record id in PocketBase's own shape (KTD13): exactly fifteen
// characters from [a-z0-9]. Every mode uses this one helper so an id has one
// shape everywhere, and a batch can reference an event whose row the server
// has not created yet. Bytes at or above RECORD_ID_BYTE_LIMIT are drawn again
// instead of folded, so the modulo cannot bias the alphabet.
export function mintRecordId(): string {
  const bytes = new Uint8Array(RECORD_ID_LENGTH)
  let id = ''

  while (id.length < RECORD_ID_LENGTH) {
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= RECORD_ID_BYTE_LIMIT) continue
      id += RECORD_ID_ALPHABET[byte % RECORD_ID_ALPHABET.length]
      if (id.length === RECORD_ID_LENGTH) break
    }
  }

  return id
}
