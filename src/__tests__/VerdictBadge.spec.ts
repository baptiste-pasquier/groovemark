import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Star, ThumbsDown } from 'lucide-vue-next'
import VerdictBadge from '../components/events/VerdictBadge.vue'
import i18n from '../i18n'
import type { Verdict } from '../types/event'

function mountBadge(verdict: Verdict | null) {
  return mount(VerdictBadge, {
    props: { verdict },
    global: { plugins: [i18n] },
  })
}

describe('VerdictBadge', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('draws one star per step of the star verdicts', () => {
    expect(mountBadge('one-star').findAllComponents(Star)).toHaveLength(1)
    expect(mountBadge('two-stars').findAllComponents(Star)).toHaveLength(2)
    expect(mountBadge('three-stars').findAllComponents(Star)).toHaveLength(3)
  })

  it('draws a dislike as a thumbs-down and never as a star', () => {
    const wrapper = mountBadge('dislike')

    expect(wrapper.findAllComponents(ThumbsDown)).toHaveLength(1)
    expect(wrapper.findAllComponents(Star)).toHaveLength(0)
  })

  it('names the absent verdict rather than rendering an empty badge', () => {
    const wrapper = mountBadge(null)

    expect(wrapper.text()).toBe('unrated')
    expect(wrapper.findAllComponents(Star)).toHaveLength(0)
    expect(wrapper.findAllComponents(ThumbsDown)).toHaveLength(0)
  })

  it('names the absent verdict in French too', () => {
    i18n.global.locale.value = 'fr'

    expect(mountBadge(null).text()).toBe('non noté')
  })

  it('carries an accessible name for every rated verdict and writes none on screen', () => {
    const cases: Array<[Verdict, string]> = [
      ['dislike', 'Not going back'],
      ['one-star', 'One star'],
      ['two-stars', 'Two stars'],
      ['three-stars', 'Three stars'],
    ]

    for (const [verdict, name] of cases) {
      const wrapper = mountBadge(verdict)
      expect(wrapper.attributes('aria-label')).toBe(name)
      // No verdict is ever written out on screen: the badge is glyphs only.
      expect(wrapper.text()).toBe('')
    }
  })
})
