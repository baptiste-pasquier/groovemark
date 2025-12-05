import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import i18n from '../i18n'
import '../__tests__/mocks/pocketbase'

describe('App', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    const pinia = createPinia()
    return { pinia }
  })

  it('renders header title', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })
    expect(wrapper.text()).toContain('MixStash')
  })
})
