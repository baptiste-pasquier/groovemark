import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '../i18n'
import { ARTISTS_COLUMNS, useArtistsUiStore } from '../stores/artistsUi'
import type { ArtistsColumn, ArtistsColumnId, ArtistsTableRow } from '../stores/artistsUi'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
import type { Artist } from '../types/artist'
import type { MusicEvent, Verdict } from '../types/event'
import type { Favorite } from '../types/favorite'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'

function artist(id: string, displayName: string, slug: string): Artist {
  return { id, displayName, slug }
}

function favorite(id: string, overrides: Partial<Favorite> = {}): Favorite {
  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title: `Mix ${id}`,
    artists: [],
    artistIds: [],
    type: 'youtube',
    thumbnail: 'https://img.test/thumb.jpg',
    timestamps: [],
    created: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  }
}

function moment(label: string, time: string, rated = false) {
  return { label, time, rated }
}

function storedEvent(
  id: string,
  name: string,
  dateAttended: string,
  venue: string,
  lineUp: Array<[artistId: string, artistName: string, verdict: Verdict | null]>,
): MusicEvent {
  return {
    id,
    name,
    dateAttended,
    venue,
    performances: lineUp.map(([artistId, artistName, verdict], index) => ({
      id: `${id}-p${index}`,
      eventId: id,
      artistId,
      artistName,
      verdict,
    })),
  }
}

// Events are the one domain whose loaded list is not writable from outside the
// store, so they are seeded through local mode's storage key and a real session
// init, exactly as the events grid's own spec seeds them. Re-seeding with
// `force` is how this spec models an event that no longer exists.
async function seedEvents(events: MusicEvent[], force = false) {
  localStorage.setItem('groovemark:events:local', JSON.stringify(events))

  const authStore = useAuthStore()
  const eventsStore = useEventsStore()
  authStore.continueInLocalMode()
  await eventsStore.initializeForCurrentSession(sessionInit(false, { force }))
}

function columnFor(id: ArtistsColumnId): ArtistsColumn {
  const column = ARTISTS_COLUMNS.find((candidate) => candidate.id === id)
  expect(column, `no column descriptor for ${id}`).toBeDefined()
  return column!
}

function shownValue(id: ArtistsColumnId, row: ArtistsTableRow) {
  return columnFor(id).cell(row, 'en')
}

function names(rows: ArtistsTableRow[]) {
  return rows.map((row) => row.artist.displayName)
}

describe('Artists UI Store', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('catalogues every artist credited by a mix or a performance, and omits one nothing credits (R16)', async () => {
    useArtistsStore().artists = [
      artist('mix-only', 'Amelie Lens', 'amelie lens'),
      artist('live-only', 'Trym', 'trym'),
      artist('both', 'Anetha', 'anetha'),
      artist('uncredited', 'Nobody Booked', 'nobody booked'),
    ]
    useFavoritesStore().favorites = [
      favorite('fav-1', { artists: ['Amelie Lens'], artistIds: ['mix-only'] }),
      favorite('fav-2', { artists: ['Anetha'], artistIds: ['both'] }),
    ]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['live-only', 'Trym', 'one-star'],
        ['both', 'Anetha', 'three-stars'],
      ]),
    ])

    const artistsUiStore = useArtistsUiStore()

    // An artist credited by both a mix and a performance appears once.
    expect(artistsUiStore.creditedArtists.map((row) => row.artist.id)).toEqual([
      'mix-only',
      'live-only',
      'both',
    ])
    expect(names(artistsUiStore.sortedRows)).toEqual(['Amelie Lens', 'Anetha', 'Trym'])
  })

  it('lists a performer credited only by a performance with no mix count and their performance count (AE4)', async () => {
    useArtistsStore().artists = [artist('live-only', 'Trym', 'trym')]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['live-only', 'Trym', 'one-star'],
      ]),
      storedEvent('event-2', 'Dour', '2025-07-15', 'Dour Grounds', [['live-only', 'Trym', null]]),
    ])

    const row = useArtistsUiStore().sortedRows[0]

    expect(row.mixes).toEqual({
      artistId: 'live-only',
      mixCount: 0,
      momentCount: 0,
      starredMomentCount: 0,
    })
    expect(row.live.performanceCount).toBe(2)
    expect(shownValue('mixes', row)).toEqual({ kind: 'text', text: '0' })
    expect(shownValue('performances', row)).toEqual({ kind: 'text', text: '2' })
  })

  it('drops a performer from the catalogue once the only event crediting them is gone (AE5)', async () => {
    useArtistsStore().artists = [artist('live-only', 'Trym', 'trym')]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['live-only', 'Trym', 'one-star'],
      ]),
    ])

    const artistsUiStore = useArtistsUiStore()
    expect(names(artistsUiStore.sortedRows)).toEqual(['Trym'])

    // The night is gone; the artist record itself stays, because deleting an
    // event removes no artist.
    await seedEvents([], true)

    expect(artistsUiStore.sortedRows).toEqual([])
    expect(useArtistsStore().artists).toHaveLength(1)
  })

  it('consumes the mix-side aggregate rather than reducing over favorites again (KTD16)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    useFavoritesStore().favorites = [
      favorite('fav-1', {
        artists: ['Anetha'],
        artistIds: ['artist-1'],
        timestamps: [moment('Drop', '01:30', true), moment('Outro', '58:00')],
      }),
      favorite('fav-2', {
        artists: ['Anetha'],
        artistIds: ['artist-1'],
        timestamps: [moment('Intro', '00:10', true)],
      }),
    ]
    await seedEvents([])

    const row = useArtistsUiStore().sortedRows[0]

    expect(row.mixes).toEqual(useFavoritesUiStore().mixAggregateFor('artist-1'))
    expect(shownValue('moments', row)).toEqual({ kind: 'text', text: '3' })
    expect(shownValue('starredMoments', row)).toEqual({ kind: 'text', text: '2' })
  })

  describe('sorting', () => {
    // One population every ordering assertion below reads, seeded in neither
    // name order nor count order so a passing assertion is a real one.
    async function seedPopulation() {
      useArtistsStore().artists = [
        artist('a3', 'Charlie', 'charlie'),
        artist('a1', 'Alpha', 'alpha'),
        artist('a5', 'Echo', 'echo'),
        artist('a2', 'Bravo', 'bravo'),
        artist('a4', 'Delta', 'delta'),
      ]
      useFavoritesStore().favorites = [
        favorite('fav-1', {
          artistIds: ['a1'],
          timestamps: [moment('a', '01:00', true), moment('b', '02:00', true)],
        }),
        favorite('fav-2', { artistIds: ['a2'], timestamps: [moment('c', '03:00', true)] }),
        favorite('fav-3', { artistIds: ['a3'], timestamps: [moment('d', '04:00')] }),
        // Echo is credited by a mix and by nothing else: never seen live.
        favorite('fav-4', { artistIds: ['a5'], timestamps: [] }),
      ]
      await seedEvents([
        // Alpha: three stars, seen twice, last on 2026-05-04.
        storedEvent('e1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
          ['a1', 'Alpha', 'three-stars'],
          ['a2', 'Bravo', 'one-star'],
        ]),
        storedEvent('e2', 'Dour', '2024-01-01', 'Dour Grounds', [
          ['a1', 'Alpha', 'dislike'],
          ['a3', 'Charlie', 'dislike'],
          // Delta was seen, and no night of theirs carries a verdict.
          ['a4', 'Delta', null],
        ]),
      ])
    }

    it('orders by starred moments in both directions', async () => {
      await seedPopulation()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSort('starredMoments')
      expect(artistsUiStore.sortDirection).toBe('desc')
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
        'Echo',
      ])

      artistsUiStore.setSort('starredMoments')
      expect(artistsUiStore.sortDirection).toBe('asc')
      // Charlie, Delta and Echo all hold zero starred moments, so they order
      // by the stated tiebreak rather than by seeded position.
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Charlie',
        'Delta',
        'Echo',
        'Bravo',
        'Alpha',
      ])
    })

    it('orders by performance count in both directions', async () => {
      await seedPopulation()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSort('performances')
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
        'Echo',
      ])

      artistsUiStore.setSort('performances')
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Echo',
        'Bravo',
        'Charlie',
        'Delta',
        'Alpha',
      ])
    })

    it('keeps every unrated and unseen row at the end of the verdict sort in both directions (R4, R17)', async () => {
      await seedPopulation()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSort('latestVerdict')
      expect(artistsUiStore.sortDirection).toBe('desc')
      // Best first, then the two rows with no rated verdict -- never above the
      // rated ones, which is what negating the shared comparator would do.
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
        'Echo',
      ])

      artistsUiStore.setSort('latestVerdict')
      expect(artistsUiStore.sortDirection).toBe('asc')
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Charlie',
        'Bravo',
        'Alpha',
        'Delta',
        'Echo',
      ])
    })

    it('keeps every never-seen row at the end of the date-last-seen sort, and breaks a tie on the same date (R17)', async () => {
      useArtistsStore().artists = [
        artist('a2', 'Bravo', 'bravo'),
        artist('a1', 'Alpha', 'alpha'),
        artist('a3', 'Charlie', 'charlie'),
        artist('a4', 'Delta', 'delta'),
      ]
      useFavoritesStore().favorites = [favorite('fav-1', { artistIds: ['a4'] })]
      await seedEvents([
        // Alpha and Bravo were last seen on the same night.
        storedEvent('e1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
          ['a2', 'Bravo', 'one-star'],
          ['a1', 'Alpha', 'three-stars'],
        ]),
        storedEvent('e2', 'Dour', '2024-01-01', 'Dour Grounds', [['a3', 'Charlie', 'dislike']]),
      ])
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSort('dateLastSeen')
      expect(names(artistsUiStore.sortedRows)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])

      artistsUiStore.setSort('dateLastSeen')
      // Reversing the direction reverses the dated rows and nothing else: the
      // tie still resolves the same way, and the never-seen row stays last.
      expect(names(artistsUiStore.sortedRows)).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta'])
    })

    it('orders by artist name in both directions, and starts there', async () => {
      await seedPopulation()
      const artistsUiStore = useArtistsUiStore()

      expect(artistsUiStore.sortColumn).toBe('artist')
      expect(artistsUiStore.sortDirection).toBe('asc')
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
        'Echo',
      ])

      artistsUiStore.setSort('artist')
      expect(names(artistsUiStore.sortedRows)).toEqual([
        'Echo',
        'Delta',
        'Charlie',
        'Bravo',
        'Alpha',
      ])
    })

    it('toggles the active column and adopts the new column’s own default direction', async () => {
      await seedPopulation()
      const artistsUiStore = useArtistsUiStore()

      // A count column answers "who has the most", so it opens descending.
      artistsUiStore.setSort('mixes')
      expect(artistsUiStore.sortColumn).toBe('mixes')
      expect(artistsUiStore.sortDirection).toBe('desc')

      artistsUiStore.setSort('mixes')
      expect(artistsUiStore.sortDirection).toBe('asc')

      // Switching column restarts from that column's default rather than
      // carrying the previous column's direction over.
      artistsUiStore.setSort('artist')
      expect(artistsUiStore.sortColumn).toBe('artist')
      expect(artistsUiStore.sortDirection).toBe('asc')
    })
  })

  it('reports the most recent rated verdict, while the date follows the most recent night (AE14)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      storedEvent('event-late', 'Peacock', '2026-08-20', 'Parc Floral', [
        ['artist-1', 'Anetha', null],
      ]),
      storedEvent('event-rated', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'two-stars'],
      ]),
    ])

    const row = useArtistsUiStore().sortedRows[0]

    // The same value the artist page leads with, read from the one aggregate.
    expect(row.live.latestRatedVerdict).toBe('two-stars')
    expect(row.live.latestRatedVerdict).toBe(
      useEventsStore().performanceHistoryFor('artist-1').latestRated?.verdict,
    )
    expect(shownValue('latestVerdict', row)).toEqual({ kind: 'verdict', verdict: 'two-stars' })
    // ...while the date beside it is the later, unrated night.
    expect(row.live.dateLastSeen).toBe('2026-08-20')
    expect(shownValue('dateLastSeen', row)).toEqual({ kind: 'text', text: 'August 20, 2026' })
  })

  it('tells an unrated performer apart from one never seen live (AE19)', async () => {
    useArtistsStore().artists = [
      artist('seen', 'Seen Unrated', 'seen unrated'),
      artist('unseen', 'Never Seen', 'never seen'),
    ]
    useFavoritesStore().favorites = [favorite('fav-1', { artistIds: ['unseen'] })]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['seen', 'Seen Unrated', null],
      ]),
    ])

    const rows = useArtistsUiStore().sortedRows
    const seen = rows.find((row) => row.artist.id === 'seen')!
    const unseen = rows.find((row) => row.artist.id === 'unseen')!

    // Seen with nothing rated: the absent verdict, through the shared display.
    expect(seen.live.verdictAvailability).toBe('unrated')
    expect(shownValue('latestVerdict', seen)).toEqual({ kind: 'verdict', verdict: null })
    // Never seen: no verdict at all rather than an unrated one.
    expect(unseen.live.verdictAvailability).toBe('unseen')
    expect(shownValue('latestVerdict', unseen)).toEqual({ kind: 'unseen' })
    expect(shownValue('dateLastSeen', unseen)).toEqual({ kind: 'unseen' })
  })

  it('writes the date last seen in the locale it is given (R6)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'two-stars'],
      ]),
    ])

    const row = useArtistsUiStore().sortedRows[0]

    expect(columnFor('dateLastSeen').cell(row, 'fr')).toEqual({ kind: 'text', text: '4 mai 2026' })
  })

  describe('search', () => {
    async function seedTwoArtists() {
      useArtistsStore().artists = [
        artist('a1', 'Amélie Lens', 'amelie lens'),
        artist('a2', 'Trym', 'trym'),
      ]
      useFavoritesStore().favorites = [
        favorite('fav-1', { title: 'Amelie Lens | Set', artistIds: ['a1'] }),
        favorite('fav-2', { title: 'Trym | Set', artistIds: ['a2'] }),
      ]
      await seedEvents([])
    }

    it('keeps only the artists whose name matches, ignoring case, accents and surrounding space (R19)', async () => {
      await seedTwoArtists()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSearch('  AMELIE ')

      expect(names(artistsUiStore.sortedRows)).toEqual(['Amélie Lens'])
    })

    it('returns nothing rather than the whole catalogue when no artist matches', async () => {
      await seedTwoArtists()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSearch('warehouse')

      expect(artistsUiStore.sortedRows).toEqual([])
      // The catalogue itself is untouched: the search filters the view of it.
      expect(artistsUiStore.creditedArtists).toHaveLength(2)
    })

    it('leaves the mixes search and the mixes artist filter untouched (R19, KTD7)', async () => {
      await seedTwoArtists()
      const favoritesUiStore = useFavoritesUiStore()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSearch('amelie')

      expect(favoritesUiStore.searchTerm).toBe('')
      expect(favoritesUiStore.currentFilter).toBe('all')
      expect(favoritesUiStore.filteredFavorites).toHaveLength(2)
    })

    it('is not narrowed by the mixes search box (R19, KTD7)', async () => {
      await seedTwoArtists()
      const favoritesUiStore = useFavoritesUiStore()
      const artistsUiStore = useArtistsUiStore()

      favoritesUiStore.setSearch('Trym')

      expect(artistsUiStore.searchTerm).toBe('')
      expect(artistsUiStore.sortedRows).toHaveLength(2)
    })

    it('clears its own search and sort on reset', async () => {
      await seedTwoArtists()
      const artistsUiStore = useArtistsUiStore()

      artistsUiStore.setSearch('amelie')
      artistsUiStore.setSort('performances')
      artistsUiStore.$reset()

      expect(artistsUiStore.searchTerm).toBe('')
      expect(artistsUiStore.sortColumn).toBe('artist')
      expect(artistsUiStore.sortDirection).toBe('asc')
      expect(artistsUiStore.sortedRows).toHaveLength(2)
    })
  })

  it('describes every column R17 names exactly once, each with its own comparator and formatter (R17)', () => {
    expect(ARTISTS_COLUMNS.map((column) => column.id)).toEqual([
      'artist',
      'mixes',
      'moments',
      'starredMoments',
      'performances',
      'latestVerdict',
      'dateLastSeen',
    ])
    // One descriptor per column, so the table and the phone view cannot offer
    // different column sets.
    expect(new Set(ARTISTS_COLUMNS.map((column) => column.id)).size).toBe(ARTISTS_COLUMNS.length)
    expect(new Set(ARTISTS_COLUMNS.map((column) => column.labelKey)).size).toBe(
      ARTISTS_COLUMNS.length,
    )
    ARTISTS_COLUMNS.forEach((column) => {
      expect(typeof column.compare).toBe('function')
      expect(typeof column.cell).toBe('function')
      expect(typeof column.hasValue).toBe('function')
    })
  })
})
