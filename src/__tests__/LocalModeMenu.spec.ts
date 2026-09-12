import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LocalModeMenu from '../components/layout/LocalModeMenu.vue'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

function mountLocalModeMenu() {
  return mount(LocalModeMenu, { global: { plugins: [i18n] } })
}

describe('LocalModeMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('keeps the panel closed until the settings button is used', async () => {
    const wrapper = mountLocalModeMenu()

    expect(wrapper.find('#export-json-btn').exists()).toBe(false)

    await wrapper.get('#settings-menu-btn').trigger('click')

    expect(wrapper.find('#export-json-btn').exists()).toBe(true)
  })

  it('offers the same app actions the signed-in menu offers', async () => {
    const wrapper = mountLocalModeMenu()
    await wrapper.get('#settings-menu-btn').trigger('click')

    expect(wrapper.find('#import-json').exists()).toBe(true)
    expect(wrapper.find('#export-json-btn').exists()).toBe(true)
    expect(wrapper.text()).toContain('Language')
  })

  it('leaves local mode, so the mode is never a dead end', async () => {
    const authStore = useAuthStore()
    const appStore = useAppStore()
    authStore.continueInLocalMode()

    const handleSignedOut = vi.spyOn(appStore, 'handleSignedOut').mockImplementation(() => {})

    const wrapper = mountLocalModeMenu()
    await wrapper.get('#settings-menu-btn').trigger('click')
    await wrapper.get('#exit-local-mode-btn').trigger('click')
    await flushPromises()

    expect(authStore.authMode).toBeNull()
    expect(handleSignedOut).toHaveBeenCalledTimes(1)
  })

  it('closes the panel when the backdrop is used', async () => {
    const wrapper = mountLocalModeMenu()
    await wrapper.get('#settings-menu-btn').trigger('click')

    await wrapper.get('[data-menu-backdrop]').trigger('click')

    expect(wrapper.find('#export-json-btn').exists()).toBe(false)
  })

  it('announces a running import on the settings trigger, panel closed or not', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.importProgress = { processed: 12, total: 80 }

    const wrapper = mountLocalModeMenu()

    expect(wrapper.get('[data-local-mode-status]').attributes('data-local-mode-status')).toBe(
      'importing',
    )
    expect(wrapper.get('[data-local-mode-status]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toBe('Importing... (12/80)')
  })
})
