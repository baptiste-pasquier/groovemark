import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Artist } from '../types/artist'
import type { ArtistPerformanceAggregate, Verdict } from '../types/event'
import { normalizeArtistName } from '../utils/artist'
import { compareVerdicts, formatDayAttended } from '../utils/event'
import { useArtistsStore } from './artists'
import { useEventsStore } from './events'
import { useFavoritesUiStore } from './favoritesUi'
import type { ArtistMixAggregate } from './favoritesUi'

// One row of the artists tab: the performer, plus the two aggregates their
// numbers come from. Neither aggregate is recomputed here -- the mix side
// belongs to the favorites-UI store and the live side to the events store, so
// this tab and the artist page can never disagree (KTD16).
export interface ArtistsTableRow {
  artist: Artist
  mixes: ArtistMixAggregate
  live: ArtistPerformanceAggregate
}

export type ArtistsColumnId =
  | 'artist'
  | 'mixes'
  | 'moments'
  | 'starredMoments'
  | 'performances'
  | 'latestVerdict'
  | 'dateLastSeen'

export type ArtistsSortDirection = 'asc' | 'desc'

// What one column shows for one row. A union rather than a string, because the
// verdict column renders through the shared badge instead of writing a label
// (KTD16), and a performer never seen live has neither a verdict nor a date.
export type ArtistsCell =
  | { kind: 'artist'; artist: Artist }
  | { kind: 'text'; text: string }
  | { kind: 'verdict'; verdict: Verdict | null }
  | { kind: 'unseen' }

// One column, described once: its id, its label, the direction it opens in,
// whether a given row has anything to compare, its comparator and its
// formatter. The table's headers, its cells and the phone view's single value
// all read this same descriptor, so a column added here reaches all three and
// none of them can offer a column the others do not.
export interface ArtistsColumn {
  id: ArtistsColumnId
  labelKey: string
  defaultDirection: ArtistsSortDirection
  hasValue: (row: ArtistsTableRow) => boolean
  compare: (left: ArtistsTableRow, right: ArtistsTableRow) => number
  cell: (row: ArtistsTableRow, locale: string) => ArtistsCell
}

// A count column. Zero is a value rather than an absent one: a performer
// credited by no mix reports zero mixes and still sorts among the others (AE4).
function countColumn(
  id: ArtistsColumnId,
  labelKey: string,
  read: (row: ArtistsTableRow) => number,
): ArtistsColumn {
  return {
    id,
    labelKey,
    // A count column answers "who has the most", so it opens with the most.
    defaultDirection: 'desc',
    hasValue: () => true,
    compare: (left, right) => read(left) - read(right),
    cell: (row) => ({ kind: 'text', text: String(read(row)) }),
  }
}

// Ascending over two stored days, which are compared as strings because the
// bare `YYYY-MM-DD` form the repositories canonicalise to sorts
// lexicographically. Nulls are partitioned out before the sort calls this, so
// the null arms exist only to keep this a total function.
function compareDays(left: string | null, right: string | null): number {
  if (left === right) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left < right ? -1 : 1
}

export const ARTISTS_COLUMNS: ArtistsColumn[] = [
  {
    id: 'artist',
    labelKey: 'artists.column_artist',
    defaultDirection: 'asc',
    hasValue: () => true,
    compare: (left, right) => left.artist.displayName.localeCompare(right.artist.displayName),
    // The performer themself rather than their name, because this cell is the
    // way into their page (KTD14) -- which keeps the component free of a
    // per-column special case for the one column that carries a link.
    cell: (row) => ({ kind: 'artist', artist: row.artist }),
  },
  countColumn('mixes', 'artists.column_mixes', (row) => row.mixes.mixCount),
  countColumn('moments', 'artists.column_moments', (row) => row.mixes.momentCount),
  countColumn('starredMoments', 'artists.column_starred', (row) => row.mixes.starredMomentCount),
  countColumn('performances', 'artists.column_performances', (row) => row.live.performanceCount),
  {
    id: 'latestVerdict',
    labelKey: 'artists.column_verdict',
    defaultDirection: 'desc',
    // Only a row carrying a *rated* verdict has something to rank. The absent
    // verdict is not a fifth, lowest step on the scale (R4), so those rows are
    // partitioned to the end instead -- see the sort below.
    hasValue: (row) => row.live.verdictAvailability === 'rated',
    compare: (left, right) =>
      compareVerdicts(left.live.latestRatedVerdict, right.live.latestRatedVerdict),
    // The most recent *rated* verdict, which is the value the artist page
    // leads with (R17, AE14). A performer seen live with nothing rated reports
    // the absent verdict through the shared badge; one never seen live reports
    // no verdict at all, which is a different fact (AE19).
    cell: (row) =>
      row.live.verdictAvailability === 'unseen'
        ? { kind: 'unseen' }
        : { kind: 'verdict', verdict: row.live.latestRatedVerdict },
  },
  {
    id: 'dateLastSeen',
    labelKey: 'artists.column_last_seen',
    defaultDirection: 'desc',
    hasValue: (row) => row.live.dateLastSeen !== null,
    compare: (left, right) => compareDays(left.live.dateLastSeen, right.live.dateLastSeen),
    // The most recent performance, rated or not, so this can name a later
    // night than the verdict beside it (R17).
    cell: (row, locale) =>
      row.live.dateLastSeen === null
        ? { kind: 'unseen' }
        : { kind: 'text', text: formatDayAttended(row.live.dateLastSeen, locale) },
  },
]

function columnById(id: ArtistsColumnId): ArtistsColumn {
  return ARTISTS_COLUMNS.find((column) => column.id === id) ?? ARTISTS_COLUMNS[0]
}

// The tiebreak that makes every ordering below a total order: two rows the
// active column cannot separate are ordered by the artist's slug, which is
// unique. It is deliberately direction-independent, so reversing a column
// reverses that column and nothing else -- and the rendered order never
// depends on the position a row held in the loaded artist list.
function compareBySlug(left: ArtistsTableRow, right: ArtistsTableRow): number {
  return left.artist.slug < right.artist.slug ? -1 : left.artist.slug > right.artist.slug ? 1 : 0
}

export const useArtistsUiStore = defineStore('artistsUi', () => {
  const artistsStore = useArtistsStore()
  const eventsStore = useEventsStore()
  const favoritesUiStore = useFavoritesUiStore()

  // The artists tab's own sort and search, and nothing else's. Neither may
  // share the refs that filter the mixes grid: three independent search boxes
  // now exist, and the mixes sort orders mixes rather than performers (KTD7).
  const sortColumn = ref<ArtistsColumnId>('artist')
  const sortDirection = ref<ArtistsSortDirection>('asc')
  const searchTerm = ref('')

  // Slug lookup for the artist address (KTD14). The artist page resolves the
  // performer from `/artists/:slug`, and the artists tab builds the same
  // address for every row, so one map serves both -- and neither reaches into
  // the artists store's own private index.
  const artistsBySlug = computed(
    () => new Map(artistsStore.artists.map((artist) => [artist.slug, artist])),
  )

  // Whether the loaded artist set can be trusted to answer "no such artist".
  // A failed load leaves that set empty or stale, so an address that resolves
  // to nothing means "cannot say" rather than "does not exist" -- which is the
  // distinction the artist page has to draw, because the events tab still
  // renders fully from denormalized names and would otherwise look healthy
  // beside a page reading as not-found. The artists tab draws the same
  // distinction: an empty catalogue after a failed load is not "no artists
  // yet".
  const artistsUnavailable = computed(() => artistsStore.loadFailed)

  // The artist an address names, or null when no loaded artist carries that
  // slug. The slug arrives already folded (it *is* a folded display name), so
  // it is matched as given rather than folded a second time.
  function artistBySlug(slug: string): Artist | null {
    return artistsBySlug.value.get(slug) ?? null
  }

  // Every artist credited by at least one mix or at least one performance, in
  // the order the artists store holds them; an artist nothing credits drops
  // out (R16). Iterating the artist records rather than the two credit sets is
  // what makes a performer credited by both appear exactly once.
  const creditedArtists = computed<ArtistsTableRow[]>(() => {
    const creditedIds = new Set<string>([
      ...Object.keys(favoritesUiStore.mixAggregatesByArtist),
      ...eventsStore.performancesByArtist.keys(),
    ])

    return artistsStore.artists
      .filter((artist) => creditedIds.has(artist.id))
      .map((artist) => ({
        artist,
        mixes: favoritesUiStore.mixAggregateFor(artist.id),
        live: eventsStore.performanceAggregateFor(artist.id),
      }))
  })

  // Filters, never orders (R19). The typed term and the name are folded
  // through the one normalizer, so a search ignores case, accents and
  // surrounding space -- and a slug *is* a folded display name, which is why
  // the name side needs no second fold.
  const filteredRows = computed<ArtistsTableRow[]>(() => {
    const normalizedSearchTerm = normalizeArtistName(searchTerm.value)
    if (normalizedSearchTerm === null) return creditedArtists.value

    return creditedArtists.value.filter((row) => row.artist.slug.includes(normalizedSearchTerm))
  })

  // What the tab renders. Rows the active column cannot value -- an unrated or
  // never-seen verdict, a date for a performer never seen live -- sit at the
  // end whichever direction is active, rather than floating to the top of the
  // descending sort. That is why the direction multiplies the comparator's
  // result only inside the valued partition: the shared verdict comparator
  // groups the absent verdict after the rated ones by returning a fixed sign,
  // so negating it would promote exactly the rows the column is not about.
  const sortedRows = computed<ArtistsTableRow[]>(() => {
    const column = columnById(sortColumn.value)
    const direction = sortDirection.value === 'asc' ? 1 : -1

    return [...filteredRows.value].sort((left, right) => {
      const leftHasValue = column.hasValue(left)
      const rightHasValue = column.hasValue(right)
      if (leftHasValue !== rightHasValue) return leftHasValue ? -1 : 1

      if (leftHasValue) {
        const ordered = column.compare(left, right) * direction
        if (ordered !== 0) return ordered
      }

      return compareBySlug(left, right)
    })
  })

  // Sorts by a column: the active one reverses, a new one opens in its own
  // default direction rather than inheriting the previous column's.
  function setSort(id: ArtistsColumnId) {
    if (sortColumn.value === id) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
      return
    }

    sortColumn.value = id
    sortDirection.value = columnById(id).defaultDirection
  }

  function setSearch(term: string) {
    searchTerm.value = term
  }

  function $reset() {
    sortColumn.value = 'artist'
    sortDirection.value = 'asc'
    searchTerm.value = ''
  }

  return {
    artistsBySlug,
    artistsUnavailable,
    sortColumn,
    sortDirection,
    searchTerm,
    creditedArtists,
    filteredRows,
    sortedRows,
    artistBySlug,
    setSort,
    setSearch,
    $reset,
  }
})
