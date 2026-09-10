import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import FavoriteCard from '../components/favorites/FavoriteCard.vue'
import i18n from '../i18n'
import { routes } from '../router'
import type { Favorite } from '../types/favorite'

const SOURCE_ROOT = resolve(process.cwd(), 'src')

const favorite: Favorite = {
  id: 'favorite-1',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Favorite',
  artists: ['Artist'],
  artistIds: [],
  type: 'youtube',
  thumbnail: 'https://img.test/thumb.jpg',
  timestamps: [{ label: 'Intro', time: '1:23', rated: true }],
}

// The card carries a link per credited artist now, so it needs a router, and
// the anchors it renders are no longer timestamps alone. Timestamp assertions
// therefore index within the timestamp row rather than over every anchor on
// the card -- the same assertion, scoped so a second kind of link cannot
// silently shift it.
function mountCard(props: { favorite: Favorite; readOnly?: boolean }): {
  wrapper: ReturnType<typeof mount>
  router: Router
} {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const wrapper = mount(FavoriteCard, { props, global: { plugins: [i18n, router] } })
  return { wrapper, router }
}

function timestampLinks(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.card-timestamp a')
}

describe('FavoriteCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('opens favorite links with noopener and noreferrer', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const { wrapper } = mountCard({ favorite })

    await wrapper.find('.card-link').trigger('click')

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('renders timestamp links with safe rel attributes', () => {
    const { wrapper } = mountCard({ favorite })

    expect(timestampLinks(wrapper)[1].attributes('rel')).toBe('noopener noreferrer')
  })

  it('does not open unsafe favorite urls', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const { wrapper } = mountCard({
      favorite: {
        ...favorite,
        url: 'javascript:alert(1)',
      },
    })

    await wrapper.find('.card-link').trigger('click')

    expect(openSpy).not.toHaveBeenCalled()
  })

  it('disables edit and delete when read-only', () => {
    const { wrapper } = mountCard({ favorite, readOnly: true })

    const editButton = wrapper.find('button:nth-of-type(1)')
    const deleteButton = wrapper.find('button:nth-of-type(2)')

    expect(editButton.attributes('disabled')).toBeDefined()
    expect(deleteButton.attributes('disabled')).toBeDefined()
  })

  it('renders a safe fallback href for unsafe timestamp urls', () => {
    const { wrapper } = mountCard({
      favorite: {
        ...favorite,
        url: 'javascript:alert(1)',
      },
    })

    const links = timestampLinks(wrapper)
    expect(links[0].attributes('href')).toBe('#')
    expect(links[1].attributes('href')).toBe('#')
  })

  it('links each credited artist to their own page, one link per name (R12)', () => {
    const { wrapper } = mountCard({
      favorite: { ...favorite, artists: ['Daft Punk', 'AC/DC'], artistIds: ['artist-1'] },
    })

    const links = wrapper.findAll('.mix-artist-link')
    expect(links).toHaveLength(2)
    expect(links[0].text()).toBe('Daft Punk')
    expect(links[1].text()).toBe('AC/DC')
    // A slug is a folded display name, not a URL token: the address is built
    // from the named route so a reserved character travels encoded (KTD14).
    expect(links[0].attributes('href')).toBe('/artists/daft%20punk')
    expect(links[1].attributes('href')).toBe('/artists/ac%2Fdc')
    // The names still read as one list.
    expect(wrapper.text()).toContain('Daft Punk, AC/DC')
  })

  it('renders no artist line at all for a mix crediting nobody', () => {
    const { wrapper } = mountCard({ favorite: { ...favorite, artists: [], artistIds: [] } })

    expect(wrapper.findAll('.mix-artist-link')).toHaveLength(0)
  })

  it('gives a credited name the same treatment on the mix card as on the event card', () => {
    const { wrapper } = mountCard({ favorite })

    expect(wrapper.find('.mix-artist-link').classes()).toContain('credited-artist-link')
    // One shared class owns the treatment, so the two cards cannot drift apart.
    const eventCard = readFileSync(resolve(SOURCE_ROOT, 'components/events/EventCard.vue'), 'utf8')
    expect(eventCard).toContain('credited-artist-link')
  })
})
