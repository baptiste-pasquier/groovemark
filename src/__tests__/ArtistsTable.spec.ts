import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
// The destination view is what mounts here, not the table alone: the table,
// the search box and the compact sort select are one surface, and R18's
// reduction to a single value column is only meaningful with all three.
import ArtistsView from '../components/artists/ArtistsView.vue'
import VerdictBadge from '../components/events/VerdictBadge.vue'
import HeaderBar from '../components/layout/HeaderBar.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { ARTISTS_COLUMNS } from '../stores/artistsUi'
import { useArtistsUiStore } from '../stores/artistsUi'
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

const SOURCE_ROOT = resolve(process.cwd(), 'src')
const TAILWIND_CSS = readFileSync(resolve(SOURCE_ROOT, 'assets/tailwind.css'), 'utf8')
const ARTISTS_TABLE_TEMPLATE = readFileSync(
  resolve(SOURCE_ROOT, 'components/artists/ArtistsTable.vue'),
  'utf8',
)
const ARTISTS_VIEW_TEMPLATE = readFileSync(
  resolve(SOURCE_ROOT, 'components/artists/ArtistsView.vue'),
  'utf8',
)

function layoutRuleFor(className: string): string {
  const rule = TAILWIND_CSS.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))
  expect(rule, `no component rule for .${className} in tailwind.css`).not.toBeNull()
  return rule![1]
}

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

async function seedEvents(events: MusicEvent[]) {
  localStorage.setItem('groovemark:events:local', JSON.stringify(events))

  const authStore = useAuthStore()
  const eventsStore = useEventsStore()
  authStore.continueInLocalMode()
  await eventsStore.initializeForCurrentSession(sessionInit(false))
}

async function mountArtists(): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
}> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push({ name: 'artists' })
  await router.isReady()

  const wrapper = mount(ArtistsView, { global: { plugins: [i18n, router] } })
  return { wrapper, router }
}

// Anetha holds two mixes and two nights; Trym is credited by one night alone.
async function seedTwoPerformers() {
  useArtistsStore().artists = [
    artist('artist-1', 'Anetha', 'anetha'),
    artist('artist-2', 'Trym', 'trym'),
  ]
  useFavoritesStore().favorites = [
    favorite('mix-1', {
      artists: ['Anetha'],
      artistIds: ['artist-1'],
      timestamps: [moment('Drop', '01:30', true), moment('Outro', '58:00')],
    }),
    favorite('mix-2', {
      artists: ['Anetha'],
      artistIds: ['artist-1'],
      timestamps: [moment('Intro', '00:10', true)],
    }),
  ]
  await seedEvents([
    storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
      ['artist-1', 'Anetha', 'three-stars'],
      ['artist-2', 'Trym', 'one-star'],
    ]),
    storedEvent('event-2', 'Dour', '2025-07-15', 'Dour Grounds', [
      ['artist-1', 'Anetha', 'dislike'],
    ]),
  ])
}

function cellText(wrapper: ReturnType<typeof mount>, rowIndex: number, columnId: string) {
  return wrapper.findAll('.artists-row')[rowIndex].find(`[data-column="${columnId}"]`).text()
}

describe('ArtistsTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('renders one row per credited artist with every column R17 names (R16, R17)', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()

    const rows = wrapper.findAll('.artists-row')
    expect(rows).toHaveLength(2)
    // Two mixes, three moments across them, two starred, two nights seen.
    expect(cellText(wrapper, 0, 'artist')).toBe('Anetha')
    expect(cellText(wrapper, 0, 'mixes')).toBe('2')
    expect(cellText(wrapper, 0, 'moments')).toBe('3')
    expect(cellText(wrapper, 0, 'starredMoments')).toBe('2')
    expect(cellText(wrapper, 0, 'performances')).toBe('2')
    expect(cellText(wrapper, 0, 'dateLastSeen')).toBe('May 4, 2026')
    // A performer credited by one night and no mix: no mix count, one night (AE4).
    expect(cellText(wrapper, 1, 'artist')).toBe('Trym')
    expect(cellText(wrapper, 1, 'mixes')).toBe('0')
    expect(cellText(wrapper, 1, 'performances')).toBe('1')
    // The stored form of a day is never printed.
    expect(wrapper.text()).not.toContain('2026-05-04')
  })

  it('links each row to that performer’s page, keyed on the slug and built from the named route (KTD14)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'AC/DC', 'ac/dc')]
    useFavoritesStore().favorites = [
      favorite('mix-1', { artists: ['AC/DC'], artistIds: ['artist-1'] }),
    ]
    await seedEvents([])

    const { wrapper } = await mountArtists()

    const link = wrapper.find('.artists-row .artists-row-link')
    expect(link.text()).toBe('AC/DC')
    // A slug is a folded display name, not a URL token, so it travels encoded.
    expect(link.attributes('href')).toBe('/artists/ac%2Fdc')
  })

  it('renders every verdict it shows through the one shared badge (R17, KTD16)', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()

    const badges = wrapper.findAllComponents(VerdictBadge)
    expect(badges.map((badge) => badge.props('verdict'))).toEqual(['three-stars', 'one-star'])
  })

  it('reports the most recent rated verdict beside a later, unrated night (AE14)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      storedEvent('event-late', 'Peacock', '2026-08-20', 'Parc Floral', [
        ['artist-1', 'Anetha', null],
      ]),
      storedEvent('event-rated', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'two-stars'],
      ]),
    ])

    const { wrapper } = await mountArtists()

    const verdictCell = wrapper.find('.artists-row [data-column="latestVerdict"]')
    expect(verdictCell.findComponent(VerdictBadge).props('verdict')).toBe('two-stars')
    // ...and the same value the artist's own page leads with.
    expect(useEventsStore().performanceHistoryFor('artist-1').latestRated?.verdict).toBe(
      'two-stars',
    )
    // The date column follows the later night, rated or not.
    expect(cellText(wrapper, 0, 'dateLastSeen')).toBe('August 20, 2026')
  })

  it('reports unrated for a performer seen live with nothing rated, and no verdict for one never seen (AE19)', async () => {
    useArtistsStore().artists = [
      artist('seen', 'Seen Unrated', 'seen unrated'),
      artist('unseen', 'Never Seen', 'never seen'),
    ]
    useFavoritesStore().favorites = [favorite('mix-1', { artistIds: ['unseen'] })]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['seen', 'Seen Unrated', null],
      ]),
    ])

    const { wrapper } = await mountArtists()

    const rows = wrapper.findAll('.artists-row')
    const neverSeenRow = rows[0].text().includes('Never Seen') ? rows[0] : rows[1]
    const seenRow = neverSeenRow === rows[0] ? rows[1] : rows[0]

    // Seen with nothing rated: the absent verdict, through the shared badge.
    const seenVerdict = seenRow.find('[data-column="latestVerdict"]')
    expect(seenVerdict.findComponent(VerdictBadge).props('verdict')).toBeNull()
    expect(seenVerdict.text()).toContain('unrated')

    // Never seen: no verdict rather than an unrated one, and no date either.
    const unseenVerdict = neverSeenRow.find('[data-column="latestVerdict"]')
    expect(unseenVerdict.findComponent(VerdictBadge).exists()).toBe(false)
    expect(unseenVerdict.text()).not.toContain('unrated')
    expect(unseenVerdict.find('.artists-not-seen').exists()).toBe(true)
    expect(neverSeenRow.find('[data-column="dateLastSeen"] .artists-not-seen').exists()).toBe(true)
  })

  it('sorts from a header the keyboard can reach, and says which column carries the sort', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()
    const artistsUiStore = useArtistsUiStore()

    // Every column offers a real button, so activation from the keyboard is
    // native rather than re-implemented on a keydown handler.
    const headers = wrapper.findAll('.artists-sort-header')
    expect(headers).toHaveLength(ARTISTS_COLUMNS.length)
    headers.forEach((header) => {
      expect(header.element.tagName).toBe('BUTTON')
      expect((header.element as HTMLButtonElement).disabled).toBe(false)
      expect(header.attributes('tabindex')).toBeUndefined()
    })

    // The active column, and only it, reports its direction to a screen reader.
    expect(wrapper.find('th[data-column="artist"]').attributes('aria-sort')).toBe('ascending')
    expect(wrapper.find('th[data-column="performances"]').attributes('aria-sort')).toBeUndefined()

    await wrapper.find('.artists-sort-header[data-sort-column="performances"]').trigger('click')

    expect(artistsUiStore.sortColumn).toBe('performances')
    expect(wrapper.find('th[data-column="performances"]').attributes('aria-sort')).toBe(
      'descending',
    )
    expect(wrapper.find('th[data-column="artist"]').attributes('aria-sort')).toBeUndefined()
    expect(wrapper.findAll('.artists-row')[0].text()).toContain('Anetha')

    // Activating the same header again reverses it.
    await wrapper.find('.artists-sort-header[data-sort-column="performances"]').trigger('click')

    expect(wrapper.find('th[data-column="performances"]').attributes('aria-sort')).toBe('ascending')
    expect(wrapper.findAll('.artists-row')[0].text()).toContain('Trym')
  })

  it('offers exactly the columns the headers offer in the compact select, from the one descriptor', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()

    const optionValues = wrapper
      .findAll('#artists-sort-select option')
      .map((option) => option.attributes('value'))
    const headerColumns = wrapper
      .findAll('.artists-sort-header')
      .map((header) => header.attributes('data-sort-column'))

    expect(optionValues).toEqual(ARTISTS_COLUMNS.map((column) => column.id))
    expect(headerColumns).toEqual(optionValues)
  })

  it('changes the value each row shows when the compact select changes the sort (R18, AE9)', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()
    const select = wrapper.find('#artists-sort-select')

    await select.setValue('starredMoments')

    // The active column is the one shown beside the name below the breakpoint.
    let shown = wrapper.findAll('.artists-row')[0].findAll('.artists-column-active')
    expect(shown).toHaveLength(1)
    expect(shown[0].attributes('data-column')).toBe('starredMoments')
    expect(shown[0].text()).toBe('2')

    await select.setValue('latestVerdict')

    shown = wrapper.findAll('.artists-row')[0].findAll('.artists-column-active')
    expect(shown).toHaveLength(1)
    expect(shown[0].attributes('data-column')).toBe('latestVerdict')
    expect(shown[0].findComponent(VerdictBadge).props('verdict')).toBe('three-stars')
    // ...and the header row marks the same column, from the same descriptor.
    expect(wrapper.find('th[data-column="latestVerdict"]').attributes('aria-sort')).toBe(
      'descending',
    )
  })

  it('hides every column but the name and the active one below the first breakpoint, from the tokens (R18, KTD9)', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()

    // Every cell carries a semantic class rather than an arbitrary value, so
    // the rules below are the ones actually deciding what the phone shows.
    const firstRow = wrapper.findAll('.artists-row')[0]
    expect(firstRow.find('[data-column="artist"]').classes()).toContain('artists-name-column')
    expect(firstRow.find('[data-column="artist"]').classes()).toContain('artists-column-active')
    expect(firstRow.find('[data-column="performances"]').classes()).toContain(
      'artists-value-column',
    )
    expect(firstRow.find('[data-column="performances"]').classes()).not.toContain(
      'artists-column-active',
    )

    // The breakpoint itself stays in CSS: no template reads a width.
    const valueRule = layoutRuleFor('artists-value-column')
    expect(valueRule).toContain('hidden')
    expect(valueRule).toContain('md:table-cell')
    // The active column is visible at every width, whichever one it is.
    expect(layoutRuleFor('artists-column-active')).toContain('table-cell')
    // The compact select is the phone's only way to change the column, so it
    // is the one control that disappears once the headers are all clickable.
    expect(layoutRuleFor('artists-sort-control')).toContain('md:hidden')
    // The name column never narrows past its own token.
    expect(layoutRuleFor('artists-name-column')).toContain('--layout-table-name-min-width')

    for (const template of [ARTISTS_TABLE_TEMPLATE, ARTISTS_VIEW_TEMPLATE]) {
      expect(template).not.toMatch(/min-\[/)
      expect(template).not.toMatch(/\[\d+(\.\d+)?rem\]/)
      expect(template).not.toMatch(/\bmd:/)
    }
  })

  it('narrows the table on a search without touching the mixes filter or search (R19, KTD7)', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()
    const artistsUiStore = useArtistsUiStore()
    const favoritesUiStore = useFavoritesUiStore()
    expect(wrapper.find('#artists-search').exists()).toBe(true)

    artistsUiStore.setSearch('trym')
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('.artists-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Trym')
    expect(favoritesUiStore.searchTerm).toBe('')
    expect(favoritesUiStore.currentFilter).toBe('all')
    expect(favoritesUiStore.filteredFavorites).toHaveLength(2)
  })

  it('says the search matched nothing rather than that no artist exists', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()
    useArtistsUiStore().setSearch('warehouse')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.artists-row')).toHaveLength(0)
    expect(wrapper.find('.artists-empty-row').exists()).toBe(true)
    expect(wrapper.text()).toContain('No artist matches your search')
  })

  it('keeps the table standing with no credited artist at all', async () => {
    await seedEvents([])

    const { wrapper } = await mountArtists()

    // The table, its header row and its columns are all still there: an empty
    // catalogue reduces the rows, not the layout.
    expect(wrapper.find('#artists-table').exists()).toBe(true)
    expect(wrapper.findAll('th')).toHaveLength(ARTISTS_COLUMNS.length)
    expect(wrapper.findAll('.artists-row')).toHaveLength(0)
    const emptyRow = wrapper.find('.artists-empty-row')
    expect(emptyRow.exists()).toBe(true)
    expect(emptyRow.find('td').attributes('colspan')).toBe(String(ARTISTS_COLUMNS.length))
    expect(emptyRow.text()).toContain('No artist is credited')
  })

  it('reads a failed artists load as unavailable rather than as an empty catalogue', async () => {
    const artistsStore = useArtistsStore()
    artistsStore.artists = []
    artistsStore.loadFailed = true
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
    ])

    const { wrapper } = await mountArtists()

    expect(wrapper.find('.artists-unavailable').exists()).toBe(true)
    expect(wrapper.find('.artists-unavailable').text().length).toBeGreaterThan(0)
    // Not the empty-catalogue state, and not a table of nothing either.
    expect(wrapper.find('#artists-table').exists()).toBe(false)
    expect(wrapper.find('.artists-empty-row').exists()).toBe(false)
    // The destination switcher stays on screen, so this is not a dead end.
    expect(wrapper.findAll('[data-destination]')).toHaveLength(3)
  })

  it('keeps the destination switcher on screen, with the artists tab marked', async () => {
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()

    expect(wrapper.findComponent(HeaderBar).exists()).toBe(true)
    expect(wrapper.findAll('[data-destination]')).toHaveLength(3)
    expect(wrapper.find('[data-destination="artists"]').attributes('aria-current')).toBe('page')
  })

  it('writes every date it shows in the active locale (R6)', async () => {
    i18n.global.locale.value = 'fr'
    await seedTwoPerformers()

    const { wrapper } = await mountArtists()

    expect(cellText(wrapper, 0, 'dateLastSeen')).toBe('4 mai 2026')
  })
})
