import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

describe('App', () => {
  beforeEach(() => {
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('shows booting state before resolving to the login page', async () => {
    const pinia = createPinia()
    const appStore = useAppStore(pinia)
    let resolveBootstrap: (() => void) | undefined

    vi.spyOn(appStore, 'bootstrap').mockImplementation(async () => {
      appStore.status = 'booting'
      await new Promise<void>((resolve) => {
        resolveBootstrap = resolve
      })
      appStore.status = 'unauthenticated'
    })

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n],
      },
    })

    expect(wrapper.text()).toContain('Loading GrooveMark...')

    resolveBootstrap?.()
    await flushPromises()

    expect(wrapper.text()).toContain('Welcome to GrooveMark')
  })
})
