import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import EventCard from '../components/events/EventCard.vue'
import VerdictBadge from '../components/events/VerdictBadge.vue'
import i18n from '../i18n'
import { routes } from '../router'
import type { MusicEvent, Performance, Verdict } from '../types/event'

function performance(
  id: string,
  artistName: string,
  verdict: Verdict | null = null,
  artistId = `artist-${id}`,
): Performance {
  return { id, eventId: 'event-1', artistId, artistName, verdict }
}

function musicEvent(overrides: Partial<MusicEvent> = {}): MusicEvent {
  return {
    id: 'event-1',
    name: 'Nuits Sonores',
    dateAttended: '2026-05-04',
    venue: 'Les Subsistances',
    performances: [],
    ...overrides,
  }
}

function mountCard(event: MusicEvent): { wrapper: ReturnType<typeof mount>; router: Router } {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const wrapper = mount(EventCard, {
    props: { event },
    global: { plugins: [i18n, router] },
  })
  return { wrapper, router }
}

describe('EventCard', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('shows the event name, the date attended, the venue and one row per performance', () => {
    const { wrapper } = mountCard(
      musicEvent({
        performances: [
          performance('p-1', 'Daft Punk', 'three-stars'),
          performance('p-2', 'Justice', 'one-star'),
        ],
      }),
    )

    expect(wrapper.text()).toContain('Nuits Sonores')
    expect(wrapper.text()).toContain('May 4, 2026')
    // The stored day is an ISO date; the card is a reading surface, so it never
    // shows the storage format.
    expect(wrapper.text()).not.toContain('2026-05-04')
    expect(wrapper.text()).toContain('Les Subsistances')

    const rows = wrapper.findAll('.event-performance')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Daft Punk')
    expect(rows[1].text()).toContain('Justice')
  })

  it('writes the day attended in the active locale (R6)', () => {
    i18n.global.locale.value = 'fr'
    const { wrapper } = mountCard(musicEvent())

    expect(wrapper.text()).toContain('4 mai 2026')
  })

  it('lists a performance with no verdict as seen-but-unrated rather than omitting it (AE2)', () => {
    const { wrapper } = mountCard(
      musicEvent({ performances: [performance('p-1', 'Anetha', null)] }),
    )

    const rows = wrapper.findAll('.event-performance')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Anetha')
    // The absent verdict is written out by the shared badge, never left blank.
    expect(rows[0].text()).toContain('unrated')
  })

  it('renders every verdict through the shared badge rather than a local mapping (KTD16)', () => {
    const verdicts: Array<Verdict | null> = [
      'dislike',
      'one-star',
      'two-stars',
      'three-stars',
      null,
    ]
    const { wrapper } = mountCard(
      musicEvent({
        performances: verdicts.map((verdict, index) =>
          performance(`p-${index}`, `Artist ${index}`, verdict),
        ),
      }),
    )

    const badges = wrapper.findAllComponents(VerdictBadge)
    expect(badges).toHaveLength(verdicts.length)
    expect(badges.map((badge) => badge.props('verdict'))).toEqual(verdicts)
  })

  it('renders an event holding no performance without an empty line-up block (R7)', () => {
    const { wrapper } = mountCard(musicEvent({ performances: [] }))

    expect(wrapper.text()).toContain('Nuits Sonores')
    expect(wrapper.find('.event-line-up').exists()).toBe(false)
    expect(wrapper.findAll('.event-performance')).toHaveLength(0)
  })

  it('renders every row of a fifteen-performance line-up, with no cap (R10)', () => {
    const performances = Array.from({ length: 15 }, (_, index) =>
      performance(`p-${index}`, `Artist ${index}`),
    )
    const { wrapper } = mountCard(musicEvent({ performances }))

    const rows = wrapper.findAll('.event-performance')
    expect(rows).toHaveLength(15)
    expect(rows[14].text()).toContain('Artist 14')
  })

  it('emits the event under revision from the open affordance (R8, AE17)', async () => {
    const { wrapper } = mountCard(musicEvent({ performances: [performance('p-1', 'Anetha')] }))

    await wrapper.find('.event-card-open').trigger('click')

    expect(wrapper.emitted('open')).toEqual([['event-1']])
  })

  it('emits the event to delete from the delete affordance (R26)', async () => {
    const { wrapper } = mountCard(musicEvent({ performances: [performance('p-1', 'Anetha')] }))

    await wrapper.find('.event-card-delete').trigger('click')

    // The card names the event and stops there: what a deletion costs, and
    // whether it happens at all, is the store's to decide.
    expect(wrapper.emitted('delete')).toEqual([['event-1']])
  })

  it('puts the delete control beside the open one, in the same block (R26)', () => {
    const { wrapper } = mountCard(musicEvent())

    const open = wrapper.find('.event-card-open')
    const remove = wrapper.find('.event-card-delete')
    expect(open.exists()).toBe(true)
    expect(remove.exists()).toBe(true)
    expect(remove.element.parentElement).toBe(open.element.parentElement)
  })

  it('disables both controls while the session is read-only, as the mix card does', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const wrapper = mount(EventCard, {
      props: { event: musicEvent(), readOnly: true },
      global: { plugins: [i18n, router] },
    })

    // The store refuses the write anyway, but a control that looks live and
    // then explains itself in a dialog reads worse than an unavailable one.
    expect(wrapper.find('.event-card-open').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.event-card-delete').attributes('disabled')).toBeDefined()
  })

  it('links a credited name to the artist page through the named route and a slug param (R12, KTD14)', () => {
    const { wrapper } = mountCard(
      musicEvent({ performances: [performance('p-1', 'Daft Punk'), performance('p-2', 'AC/DC')] }),
    )

    const links = wrapper.findAll('.event-artist-link')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('/artists/daft%20punk')
    // A slug is a folded display name, not a URL token: concatenating it would
    // build an address the artist route never matches.
    expect(links[1].attributes('href')).toBe('/artists/ac%2Fdc')
  })
})
