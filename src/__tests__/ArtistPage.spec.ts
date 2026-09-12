import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import ArtistPage from '../components/artists/ArtistPage.vue'
import VerdictBadge from '../components/events/VerdictBadge.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useFavoritesStore } from '../stores/favorites'
import type { Artist } from '../types/artist'
import type { MusicEvent, Verdict } from '../types/event'
import type { Favorite } from '../types/favorite'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'

const SOURCE_ROOT = resolve(process.cwd(), 'src')
const TAILWIND_CSS = readFileSync(resolve(SOURCE_ROOT, 'assets/tailwind.css'), 'utf8')
const ARTIST_PAGE_TEMPLATE = readFileSync(
  resolve(SOURCE_ROOT, 'components/artists/ArtistPage.vue'),
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

// Events are the one domain whose loaded list is not writable from outside the
// store, so they are seeded the way the events grid's own spec seeds them:
// through local mode's storage key and a real session init. Nothing here
// reaches a network repository -- the page must read loaded state only.
async function seedEvents(events: MusicEvent[]) {
  localStorage.setItem('groovemark:events:local', JSON.stringify(events))

  const authStore = useAuthStore()
  const eventsStore = useEventsStore()
  authStore.continueInLocalMode()
  await eventsStore.initializeForCurrentSession(sessionInit(false))
}

async function mountPage(slug: string): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
}> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push({ name: 'artist', params: { slug } })
  await router.isReady()

  const wrapper = mount(ArtistPage, { global: { plugins: [i18n, router] } })
  return { wrapper, router }
}

describe('ArtistPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('renders both halves for a performer with mixes and performances, with the three mix counts (R13)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
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
      favorite('mix-3', { artists: ['Trym'], artistIds: ['artist-2'] }),
    ]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
      storedEvent('event-2', 'Dour', '2025-07-15', 'Dour Grounds', [
        ['artist-1', 'Anetha', 'one-star'],
      ]),
    ])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-page-name').text()).toBe('Anetha')

    // Two mixes kept, three moments across them, two of them starred. The three
    // counts are chips inside the mixes block, so each carries its own label.
    expect(wrapper.findAll('.artist-stat').map((chip) => chip.text())).toEqual([
      '2 mixes',
      '3 moments',
      '2 starred',
    ])
    expect(wrapper.findAll('#artist-mixes-grid .artist-mix-card')).toHaveLength(2)
    expect(wrapper.find('.artist-mixes-empty').exists()).toBe(false)

    const performances = wrapper.findAll('.artist-performance')
    expect(performances).toHaveLength(2)
    // Newest first, each with its event, date and venue.
    expect(performances[0].text()).toContain('Nuits Sonores')
    expect(performances[0].text()).toContain('May 4, 2026')
    expect(performances[0].text()).toContain('Les Subsistances')
    expect(performances[1].text()).toContain('Dour')
    expect(performances[1].text()).toContain('July 15, 2025')
    // The page never prints the storage form of a day.
    expect(wrapper.text()).not.toContain('2026-05-04')
    expect(wrapper.find('.artist-live-empty').exists()).toBe(false)
  })

  it('leads the live half with the most recent rated verdict and that performance’s date, not the unrated latest one (AE1)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      // The latest night carries no verdict; the one before it carries two stars.
      storedEvent('event-late', 'Peacock', '2026-08-20', 'Parc Floral', [
        ['artist-1', 'Anetha', null],
      ]),
      storedEvent('event-rated', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'two-stars'],
      ]),
    ])

    const { wrapper } = await mountPage('anetha')

    const leading = wrapper.find('.artist-latest-verdict')
    expect(leading.exists()).toBe(true)
    // The leading verdict goes through the one shared badge (KTD16).
    const leadingBadge = leading.findComponent(VerdictBadge)
    expect(leadingBadge.props('verdict')).toBe('two-stars')
    // ...and the date beside it is the rated night's, not the latest night's.
    expect(leading.text()).toContain('May 4, 2026')
    expect(leading.text()).not.toContain('August 20, 2026')
    expect(wrapper.find('.artist-no-rated-verdict').exists()).toBe(false)

    // Both nights are still listed, newest first.
    const performances = wrapper.findAll('.artist-performance')
    expect(performances).toHaveLength(2)
    expect(performances[0].text()).toContain('Peacock')
    expect(performances[0].text()).toContain('unrated')
    expect(performances[1].text()).toContain('Nuits Sonores')
  })

  it('shows no leading verdict for a performer with performances but none rated, and still lists them all (AE3)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      storedEvent('event-1', 'Peacock', '2026-08-20', 'Parc Floral', [
        ['artist-1', 'Anetha', null],
      ]),
      storedEvent('event-2', 'Dour', '2025-07-15', 'Dour Grounds', [['artist-1', 'Anetha', null]]),
    ])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-latest-verdict').exists()).toBe(false)
    expect(wrapper.find('.artist-no-rated-verdict').exists()).toBe(true)
    expect(wrapper.findAll('.artist-performance')).toHaveLength(2)
    expect(wrapper.find('.artist-live-empty').exists()).toBe(false)
  })

  it('renders the mixes half as empty rather than omitting it for a performer with no mix (R15)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    useFavoritesStore().favorites = [favorite('mix-1', { artists: ['Trym'], artistIds: ['a-2'] })]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
    ])

    const { wrapper } = await mountPage('anetha')

    // The section is there, with its heading and its counts at zero.
    expect(wrapper.find('#artist-mixes').exists()).toBe(true)
    expect(wrapper.findAll('.artist-stat').map((chip) => chip.text())).toEqual([
      '0 mixes',
      '0 moments',
      '0 starred',
    ])
    expect(wrapper.find('.artist-mixes-empty').exists()).toBe(true)
    expect(wrapper.find('#artist-mixes-grid').exists()).toBe(false)
    // ...and the empty half does not swallow the half that has something.
    expect(wrapper.findAll('.artist-performance')).toHaveLength(1)
  })

  it('renders the live half as empty rather than omitting it for a performer never seen live (R15)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    useFavoritesStore().favorites = [
      favorite('mix-1', {
        artists: ['Anetha'],
        artistIds: ['artist-1'],
        timestamps: [moment('Drop', '01:30', true)],
      }),
    ]
    await seedEvents([])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('#artist-live').exists()).toBe(true)
    expect(wrapper.find('.artist-live-empty').exists()).toBe(true)
    expect(wrapper.findAll('.artist-performance')).toHaveLength(0)
    expect(wrapper.find('.artist-latest-verdict').exists()).toBe(false)
    // The empty live half is not the same as having nothing rated.
    expect(wrapper.find('.artist-no-rated-verdict').exists()).toBe(false)
    expect(wrapper.findAll('#artist-mixes-grid .artist-mix-card')).toHaveLength(1)
  })

  it('says the live half is unavailable rather than claiming the artist was never seen live', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    useFavoritesStore().favorites = [
      favorite('mix-1', { artists: ['Anetha'], artistIds: ['artist-1'] }),
    ]
    // The artists half loaded, so the page renders; the events half did not, so
    // its list is empty because it is unknown, not because it is empty.
    await seedEvents([])
    useEventsStore().loadFailed = true

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-live-unavailable').exists()).toBe(true)
    expect(wrapper.find('.artist-live-unavailable').text().length).toBeGreaterThan(0)
    // "You haven't seen this artist live yet" would be a claim the page cannot make.
    expect(wrapper.find('.artist-live-empty').exists()).toBe(false)
    // The mixes half loaded and still renders in full.
    expect(wrapper.findAll('#artist-mixes-grid .artist-mix-card')).toHaveLength(1)
    expect(wrapper.find('.artist-mixes-empty').exists()).toBe(false)
  })

  it('says the mixes half is unavailable rather than claiming no mix credits the artist', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    // The mirror image of the live half: the favorites load failed, so the
    // empty list is unknown rather than empty.
    const favoritesStore = useFavoritesStore()
    favoritesStore.favorites = []
    favoritesStore.loadFailed = true
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
    ])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-mixes-unavailable').exists()).toBe(true)
    expect(wrapper.find('.artist-mixes-unavailable').text().length).toBeGreaterThan(0)
    expect(wrapper.find('.artist-mixes-empty').exists()).toBe(false)
    // Three zero chips beside that notice would contradict it.
    expect(wrapper.findAll('.artist-stat')).toHaveLength(0)
    // The live half loaded and still renders in full.
    expect(wrapper.findAll('.artist-performance')).toHaveLength(1)
    expect(wrapper.find('.artist-live-unavailable').exists()).toBe(false)
  })

  it('counts moments and starred moments across the mixes, including a mix with no moment', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    useFavoritesStore().favorites = [
      favorite('mix-1', {
        artists: ['Anetha'],
        artistIds: ['artist-1'],
        timestamps: [moment('a', '01:00', true), moment('b', '02:00'), moment('c', '03:00', true)],
      }),
      // No moment at all: it counts as a mix kept and adds nothing else.
      favorite('mix-2', { artists: ['Anetha'], artistIds: ['artist-1'] }),
      favorite('mix-3', {
        artists: ['Anetha'],
        artistIds: ['artist-1'],
        timestamps: [moment('d', '04:00')],
      }),
    ]
    await seedEvents([])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.findAll('.artist-stat').map((chip) => chip.text())).toEqual([
      '3 mixes',
      '4 moments',
      '2 starred',
    ])
  })

  it('renders a not-found message with a way back to the artists tab for an address no artist answers (KTD14)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([])

    const { wrapper } = await mountPage('renamed since the link was shared')

    expect(wrapper.find('.artist-not-found').exists()).toBe(true)
    expect(wrapper.find('.artist-not-found').text().length).toBeGreaterThan(0)
    expect(wrapper.find('.artist-back-link').attributes('href')).toBe('/artists')
    // Not an empty page, and not the two halves either.
    expect(wrapper.find('#artist-mixes').exists()).toBe(false)
    expect(wrapper.find('#artist-live').exists()).toBe(false)
    // The destination switcher stays on screen, so the address is not a dead end.
    expect(wrapper.findAll('[data-destination]')).toHaveLength(3)
  })

  it('resolves an artist whose name carries a slash from its own address (KTD14)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'AC/DC', 'ac/dc')]
    useFavoritesStore().favorites = [
      favorite('mix-1', { artists: ['AC/DC'], artistIds: ['artist-1'] }),
    ]
    await seedEvents([])

    const { wrapper, router } = await mountPage('ac/dc')

    // The address carries the slug percent-encoded, and still resolves.
    expect(router.currentRoute.value.fullPath).toBe('/artists/ac%2Fdc')
    expect(wrapper.find('.artist-page-name').text()).toBe('AC/DC')
    expect(wrapper.find('.artist-not-found').exists()).toBe(false)
  })

  it('distinguishes an artists load that failed from an address no artist answers', async () => {
    const artistsStore = useArtistsStore()
    // A failed load with an empty cache: no artist resolves, while the events
    // half would still render from the denormalized names.
    artistsStore.artists = []
    artistsStore.loadFailed = true
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
    ])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-unavailable').exists()).toBe(true)
    expect(wrapper.find('.artist-unavailable').text().length).toBeGreaterThan(0)
    // Not the not-found state, and not an artist with no mixes either.
    expect(wrapper.find('.artist-not-found').exists()).toBe(false)
    expect(wrapper.find('#artist-mixes').exists()).toBe(false)
    expect(wrapper.findAll('[data-destination]')).toHaveLength(3)
  })

  it('still shows the page for an artist that resolves out of the cache after a failed load', async () => {
    const artistsStore = useArtistsStore()
    artistsStore.artists = [artist('artist-1', 'Anetha', 'anetha')]
    artistsStore.loadFailed = true
    await seedEvents([])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-unavailable').exists()).toBe(false)
    expect(wrapper.find('.artist-page-name').text()).toBe('Anetha')
  })

  it('renders both halves as stacked sections with no raw breakpoint literal in the template', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([])

    const { wrapper } = await mountPage('anetha')

    const rule = layoutRuleFor(wrapper.find('main').classes()[0])
    expect(rule).toContain('flex-col')

    expect(ARTIST_PAGE_TEMPLATE).not.toMatch(/min-\[/)
    expect(ARTIST_PAGE_TEMPLATE).not.toMatch(/\[\d+(\.\d+)?rem\]/)
    // Both halves are in the document, in reading order: live, then mixes. The
    // live half leads because the page answers "worth seeing again".
    const sections = wrapper.findAll('section')
    expect(sections.map((section) => section.attributes('id'))).toEqual([
      'artist-live',
      'artist-mixes',
    ])
  })

  it('renders every verdict it shows through the one shared badge (KTD16)', async () => {
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
      storedEvent('event-2', 'Dour', '2025-07-15', 'Dour Grounds', [['artist-1', 'Anetha', null]]),
    ])

    const { wrapper } = await mountPage('anetha')

    // One badge per performance, plus the leading one.
    const badges = wrapper.findAllComponents(VerdictBadge)
    expect(badges.map((badge) => badge.props('verdict'))).toEqual([
      'three-stars',
      'three-stars',
      null,
    ])
  })

  it('writes every date it shows in the active locale (R6)', async () => {
    i18n.global.locale.value = 'fr'
    useArtistsStore().artists = [artist('artist-1', 'Anetha', 'anetha')]
    await seedEvents([
      storedEvent('event-1', 'Nuits Sonores', '2026-05-04', 'Les Subsistances', [
        ['artist-1', 'Anetha', 'three-stars'],
      ]),
    ])

    const { wrapper } = await mountPage('anetha')

    expect(wrapper.find('.artist-latest-verdict').text()).toContain('4 mai 2026')
    expect(wrapper.find('.artist-performance').text()).toContain('4 mai 2026')
  })
})
