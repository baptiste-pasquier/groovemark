import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '../i18n'
import LoginPage from '../components/auth/LoginPage.vue'
import { useAuthStore } from '../stores/auth'
import { useAppStore } from '../stores/app'
import { resetLocalStorageMock } from './mocks/localStorage'
import { resetPocketbaseMocks } from './mocks/pocketbase'

describe('LoginPage', () => {
  beforeEach(() => {
    resetLocalStorageMock()
    resetPocketbaseMocks()
    i18n.global.locale.value = 'en'
  })

  it('does not bootstrap the authenticated session when Google sign-in returns false', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)

    const authStore = useAuthStore()
    const appStore = useAppStore()

    vi.spyOn(authStore, 'signInWithGoogle').mockResolvedValue(false)
    const handleAuthenticatedSessionSpy = vi
      .spyOn(appStore, 'handleAuthenticatedSession')
      .mockResolvedValue()

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [pinia, i18n],
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(handleAuthenticatedSessionSpy).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Failed to sign in with Google. Please try again.')
  })
})
