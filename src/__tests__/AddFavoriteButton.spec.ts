import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AddFavoriteButton from '../components/favorites/AddFavoriteButton.vue'
import i18n from '../i18n'

describe('AddFavoriteButton', () => {
  it('is disabled when the disabled prop is true', () => {
    const wrapper = mount(AddFavoriteButton, {
      props: { disabled: true },
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('is enabled by default and emits click', async () => {
    const wrapper = mount(AddFavoriteButton, {
      global: { plugins: [i18n] },
    })

    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
