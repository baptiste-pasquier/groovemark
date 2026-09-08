import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ArtistTagsInput from '../components/favorites/ArtistTagsInput.vue'
import i18n from '../i18n'

describe('ArtistTagsInput', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('cleans up the document click listener on unmount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

    const wrapper = mount(ArtistTagsInput, {
      props: {
        modelValue: [],
        suggestions: [],
      },
      global: {
        plugins: [i18n],
      },
    })

    const addedListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'click',
    )?.[1]

    wrapper.unmount()

    const removedListener = removeEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === 'click',
    )?.[1]

    expect(addedListener).toBeDefined()
    expect(removedListener).toBe(addedListener)
  })

  it('dedupes tags with different casing/accents into a single chip', async () => {
    const wrapper = mount(ArtistTagsInput, {
      props: {
        modelValue: [],
        suggestions: [],
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')

    await input.setValue('Amelie Lens')
    await input.trigger('keydown', { key: 'Enter' })

    await input.setValue('AMELIE LENS')
    await input.trigger('keydown', { key: 'Enter' })

    const chips = wrapper.findAll('span > span')
    expect(chips).toHaveLength(1)
    expect(chips[0].text()).toBe('Amelie Lens')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeDefined()
    const lastEmit = emitted?.[emitted.length - 1]?.[0] as string[]
    expect(lastEmit).toEqual(['Amelie Lens'])
  })

  it('excludes a suggestion already tagged under a different spelling', async () => {
    const wrapper = mount(ArtistTagsInput, {
      props: {
        modelValue: ['AMELIE LENS'],
        suggestions: ['Amelie Lens'],
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    await input.trigger('focus')

    const suggestionTexts = wrapper.findAll('ul li span').map((el) => el.text())
    expect(suggestionTexts).not.toContain('Amelie Lens')
  })

  it('matches suggestions across accents regardless of typed accent', async () => {
    const wrapper = mount(ArtistTagsInput, {
      props: {
        modelValue: [],
        suggestions: ['Amélie Lens'],
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    await input.trigger('focus')
    await input.setValue('amelie')

    const suggestionTexts = wrapper.findAll('ul li span').map((el) => el.text())
    expect(suggestionTexts).toContain('Amélie Lens')
  })
})
