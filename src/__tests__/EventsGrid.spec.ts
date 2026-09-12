import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import EventsGrid from '../components/events/EventsGrid.vue'
import EventsSearchBar from '../components/events/EventsSearchBar.vue'
import HeaderBar from '../components/layout/HeaderBar.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { useArtistsStore } from '../stores/artists'
import { useAuthStore } from '../stores/auth'
import { useEventsStore } from '../stores/events'
import { useEventsUiStore } from '../stores/eventsUi'
import type { MusicEvent } from '../types/event'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'
import { sessionInit } from './mocks/sessionInit'

const SOURCE_ROOT = resolve(process.cwd(), 'src')
const TAILWIND_CSS = readFileSync(resolve(SOURCE_ROOT, 'assets/tailwind.css'), 'utf8')
const MIXES_GRID_TEMPLATE = readFileSync(
  resolve(SOURCE_ROOT, 'components/favorites/FavoritesGrid.vue'),
  'utf8',
)
const EVENTS_GRID_TEMPLATE = readFileSync(
  resolve(SOURCE_ROOT, 'components/events/EventsGrid.vue'),
  'utf8',
)

function layoutRuleFor(className: string): string {
  const rule = TAILWIND_CSS.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))
  expect(rule, `no component rule for .${className} in tailwind.css`).not.toBeNull()
  return rule![1]
}

function storedEvent(id: string, name: string, dateAttended: string, venue: string): MusicEvent {
  return { id, name, dateAttended, venue, performances: [] }
}

// Seeded in neither date nor id order, so an assertion on the rendered order
// cannot pass by accident.
const SEEDED_EVENTS: MusicEvent[] = [
  storedEvent('mid', 'Nuits Sonores', '2025-05-04', 'Les Subsistances'),
  storedEvent('old', 'Peacock Society', '2024-07-06', 'Parc Floral'),
  storedEvent('new', 'Dour Festival', '2026-07-15', 'Dour Grounds'),
]

async function seedLocalEvents(events: MusicEvent[] = SEEDED_EVENTS) {
  localStorage.setItem('groovemark:events:local', JSON.stringify(events))

  const authStore = useAuthStore()
  const eventsStore = useEventsStore()
  authStore.continueInLocalMode()
  await eventsStore.initializeForCurrentSession(sessionInit(false))

  return eventsStore
}

const EVENT_CARD_STUB = {
  name: 'EventCard',
  template: '<div class="event-card" @click="$emit(\'open\', event.id)">{{ event.id }}</div>',
  props: ['event', 'readOnly'],
  emits: ['open'],
}

async function mountEventsGrid(): Promise<{
  wrapper: ReturnType<typeof mount>
  router: Router
}> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/events')
  await router.isReady()

  const wrapper = mount(EventsGrid, {
    global: { plugins: [i18n, router], stubs: { EventCard: EVENT_CARD_STUB } },
  })

  return { wrapper, router }
}

describe('EventsGrid', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('renders one card per event, in the order the store returns (R9, R11)', async () => {
    const eventsStore = await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()

    const cards = wrapper.findAllComponents({ name: 'EventCard' })
    expect(cards.map((card) => (card.props('event') as MusicEvent).id)).toEqual([
      'new',
      'mid',
      'old',
    ])
    // Same order as the store's, so a sort added in the component would fail.
    expect(cards.map((card) => (card.props('event') as MusicEvent).id)).toEqual(
      eventsStore.events.map((event) => event.id),
    )
  })

  it('lays the cards out through the same shared class as the mixes grid (KTD8, R9)', async () => {
    await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()
    const grid = wrapper.find('#events-grid')

    expect(grid.exists()).toBe(true)
    expect(grid.classes()).toHaveLength(1)

    const gridClass = grid.classes()[0]
    // One owner for the progression: the mixes template carries the very same
    // class, so a breakpoint change cannot reach one grid and miss the other.
    expect(MIXES_GRID_TEMPLATE).toContain(`class="${gridClass}"`)
    // And the shared class is named neutrally rather than after the mixes tab.
    expect(gridClass).not.toContain('favorite')
  })

  it('renders one column below the first breakpoint and fixed-width columns above it (R9)', async () => {
    await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()
    const rule = layoutRuleFor(wrapper.find('#events-grid').classes()[0])

    expect(rule).toContain('grid-cols-1')
    expect(rule).toContain('md:grid-cols-[repeat(2,var(--layout-card-width))]')
    expect(rule).toContain('layout-3col:grid-cols-[repeat(3,var(--layout-card-width))]')
    expect(rule).toContain('layout-4col:grid-cols-[repeat(4,var(--layout-card-width))]')
  })

  it('keeps both grid templates free of raw breakpoint literals', () => {
    for (const template of [MIXES_GRID_TEMPLATE, EVENTS_GRID_TEMPLATE]) {
      expect(template).not.toMatch(/min-\[/)
      expect(template).not.toMatch(/\[\d+(\.\d+)?rem\]/)
    }
  })

  it('renders every event in one pass, with no batching and no observer sentinel', async () => {
    await seedLocalEvents(
      Array.from({ length: 25 }, (_, index) =>
        storedEvent(
          `event-${index}`,
          `Night ${index}`,
          `2026-01-${String(index + 1).padStart(2, '0')}`,
          'Le Sucre',
        ),
      ),
    )

    const { wrapper } = await mountEventsGrid()

    expect(wrapper.findAllComponents({ name: 'EventCard' })).toHaveLength(25)
    expect(wrapper.find('[class="h-1"]').exists()).toBe(false)
  })

  it('keeps the destination switcher on screen', async () => {
    await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()

    expect(wrapper.findComponent(HeaderBar).exists()).toBe(true)
    expect(wrapper.findAll('[data-destination]')).toHaveLength(3)
  })

  it('offers the events search above the grid', async () => {
    await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()

    expect(wrapper.findComponent(EventsSearchBar).exists()).toBe(true)
  })

  it('narrows the grid on a venue search and restores the full list when cleared (AE18)', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    const { wrapper } = await mountEventsGrid()
    expect(wrapper.findAllComponents({ name: 'EventCard' })).toHaveLength(3)

    eventsUiStore.setSearch('subsist')
    await wrapper.vm.$nextTick()

    let cards = wrapper.findAllComponents({ name: 'EventCard' })
    expect(cards.map((card) => (card.props('event') as MusicEvent).id)).toEqual(['mid'])

    eventsUiStore.setSearch('')
    await wrapper.vm.$nextTick()

    cards = wrapper.findAllComponents({ name: 'EventCard' })
    expect(cards.map((card) => (card.props('event') as MusicEvent).id)).toEqual([
      'new',
      'mid',
      'old',
    ])
  })

  it('records the event a card reopens as the one under revision (R8, AE17)', async () => {
    await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()
    expect((wrapper.vm as unknown as { openEventId: string | null }).openEventId).toBeNull()

    await wrapper.findAllComponents({ name: 'EventCard' })[1].trigger('click')

    expect((wrapper.vm as unknown as { openEventId: string | null }).openEventId).toBe('mid')
  })

  it('hands each card the one read-only switch, as the mixes grid does (KTD6)', async () => {
    await seedLocalEvents()
    const artistsStore = useArtistsStore()

    const { wrapper } = await mountEventsGrid()
    expect(wrapper.findAllComponents({ name: 'EventCard' })[0].props('readOnly')).toBe(false)

    // A degraded session is read-only everywhere, so the events cards grey
    // their controls out exactly as the mix cards do rather than accepting a
    // gesture the store will refuse.
    artistsStore.loadFailed = true
    await nextTick()

    expect(wrapper.findAllComponents({ name: 'EventCard' })[0].props('readOnly')).toBe(true)
  })

  it('invites a first event when none is recorded yet', async () => {
    await seedLocalEvents([])

    const { wrapper } = await mountEventsGrid()

    expect(wrapper.find('#events-grid').exists()).toBe(false)
    expect(wrapper.text()).toContain("You haven't recorded any event yet")
  })

  it('says the events could not be loaded rather than that none was ever recorded', async () => {
    await seedLocalEvents([])
    const eventsStore = useEventsStore()
    eventsStore.loadFailed = true
    await nextTick()

    const { wrapper } = await mountEventsGrid()

    expect(wrapper.find('.events-unavailable').exists()).toBe(true)
    expect(wrapper.find('.events-unavailable').text().length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain("You haven't recorded any event yet")
    // Nothing to search through and nothing to add to, so the controls go with
    // the list rather than sitting there greyed out with no reason given --
    // the same shape the artists catalogue takes when its load fails.
    expect(wrapper.find('#events-grid').exists()).toBe(false)
    expect(wrapper.findComponent(EventsSearchBar).exists()).toBe(false)
    expect(wrapper.find('#add-event-btn').exists()).toBe(false)
  })

  it('says the search matched nothing rather than that no event exists', async () => {
    await seedLocalEvents()
    const eventsUiStore = useEventsUiStore()

    const { wrapper } = await mountEventsGrid()
    eventsUiStore.setSearch('warehouse')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#events-grid').exists()).toBe(false)
    expect(wrapper.text()).toContain('No event matches your search')
  })

  it('gives the controls row and the grid one left edge at every column count', async () => {
    await seedLocalEvents()
    const { wrapper } = await mountEventsGrid()

    // The row and the grid have to be inside the same box, or the grid's own
    // centring pulls it away from the row above it.
    const box = wrapper.get('.card-grid-body')
    expect(box.element.contains(wrapper.get('.view-controls').element)).toBe(true)
    expect(box.element.contains(wrapper.get('#events-grid').element)).toBe(true)

    // ...and that box has to be exactly as wide as the grid at each
    // breakpoint. Asserting the two progressions agree, rather than asserting
    // three widths, is what catches a fifth column added without a width to
    // match it.
    const boxRule = layoutRuleFor('card-grid-body')
    const gridRule = layoutRuleFor('card-grid')

    const columnsAt: [string, string][] = [
      ['md:', '2'],
      ['layout-3col:', '3'],
      ['layout-4col:', '4'],
    ]

    for (const [variant, columns] of columnsAt) {
      expect(gridRule).toContain(
        `${variant}grid-cols-[repeat(${columns},var(--layout-card-width))]`,
      )
      expect(boxRule).toContain(`${variant}w-[var(--layout-grid-width-${columns}col)]`)
      expect(TAILWIND_CSS).toContain(`--layout-grid-width-${columns}col: calc(`)
    }
  })

  it('caps the search field at one token and sizes every control on the row by another', () => {
    expect(TAILWIND_CSS).toContain('--layout-search-max-width: 24rem;')

    const searchRule = layoutRuleFor('view-search')
    expect(searchRule).toContain('var(--layout-search-max-width)')
    // The search field, the icon buttons beside it and the create button at
    // its end are read as one row, so one token sizes all three. Asserting the
    // token rather than a pixel value is what stops them drifting apart again.
    expect(TAILWIND_CSS).toContain('--layout-control-height: 2.75rem;')
    for (const control of ['view-search-input', 'view-control-button', 'view-control-action']) {
      expect(layoutRuleFor(control)).toContain('h-[var(--layout-control-height)]')
    }
  })

  it('lays the events controls out with the class the three destinations share', async () => {
    const { wrapper } = await mountEventsGrid()
    const row = wrapper.get('.view-controls')

    expect(row.find('.view-search').exists()).toBe(true)
    expect(row.find('#add-event-btn').exists()).toBe(true)
    expect(layoutRuleFor('view-controls')).toMatch(/sm:flex-row/)
  })

  it('puts the sort beside the search and reverses the rendered order', async () => {
    await seedLocalEvents()

    const { wrapper } = await mountEventsGrid()
    const eventsUiStore = useEventsUiStore()

    const sortButton = wrapper.get('#events-sort-btn')
    expect(sortButton.element.closest('.view-controls-search')).not.toBeNull()

    const before = wrapper.findAll('.event-card').map((card) => card.text())
    expect(before).toEqual(['new', 'mid', 'old'])

    await sortButton.trigger('click')
    await nextTick()

    expect(eventsUiStore.sortOrder).toBe('oldest')
    const after = wrapper.findAll('.event-card').map((card) => card.text())
    expect(after).toEqual(['old', 'mid', 'new'])
  })
})
