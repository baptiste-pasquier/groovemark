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
})
