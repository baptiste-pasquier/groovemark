import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FavoriteCard from '../components/favorites/FavoriteCard.vue'
import type { Favorite } from '../types/favorite'

const favorite: Favorite = {
  id: 'favorite-1',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Favorite',
  artists: ['Artist'],
  type: 'youtube',
  thumbnail: 'https://img.test/thumb.jpg',
  timestamps: [{ label: 'Intro', time: '1:23', rated: true }],
}

describe('FavoriteCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('opens favorite links with noopener and noreferrer', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const wrapper = mount(FavoriteCard, {
      props: { favorite },
    })

    await wrapper.find('.card-link').trigger('click')

    expect(openSpy).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('renders timestamp links with safe rel attributes', () => {
    const wrapper = mount(FavoriteCard, {
      props: { favorite },
    })

    const timestampLinks = wrapper.findAll('a')
    expect(timestampLinks[1].attributes('rel')).toBe('noopener noreferrer')
  })

  it('does not open unsafe favorite urls', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const wrapper = mount(FavoriteCard, {
      props: {
        favorite: {
          ...favorite,
          url: 'javascript:alert(1)',
        },
      },
    })

    await wrapper.find('.card-link').trigger('click')

    expect(openSpy).not.toHaveBeenCalled()
  })

  it('renders a safe fallback href for unsafe timestamp urls', () => {
    const wrapper = mount(FavoriteCard, {
      props: {
        favorite: {
          ...favorite,
          url: 'javascript:alert(1)',
        },
      },
    })

    const timestampLinks = wrapper.findAll('a')
    expect(timestampLinks[0].attributes('href')).toBe('#')
    expect(timestampLinks[1].attributes('href')).toBe('#')
  })
})
