import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { useFavoritesUiStore } from '../stores/favoritesUi'
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

    const router = createRouter({ history: createMemoryHistory(), routes })
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n, router],
      },
    })

    expect(wrapper.text()).toContain('Loading GrooveMark...')
    expect(wrapper.find('.app-shell').exists()).toBe(false)
    expect(wrapper.find('nav').exists()).toBe(false)

    resolveBootstrap?.()
    await flushPromises()

    expect(wrapper.text()).toContain('Welcome to GrooveMark')
    expect(wrapper.find('.app-shell').exists()).toBe(false)
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})

describe('useAppStore', () => {
  beforeEach(() => {
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('recovers to unauthenticated and clears the auth session when initializing an authenticated session fails', async () => {
    const pinia = createPinia()
    const appStore = useAppStore(pinia)
    const authStore = useAuthStore(pinia)
    const favoritesStore = useFavoritesStore(pinia)
    const favoritesUiStore = useFavoritesUiStore(pinia)

    await authStore.signInWithGoogle()
    vi.spyOn(favoritesStore, 'initializeForCurrentSession').mockRejectedValue(
      new Error('Google favorites require a user id.'),
    )

    await expect(appStore.handleAuthenticatedSession()).resolves.toBeUndefined()

    expect(appStore.status).toBe('unauthenticated')
    expect(authStore.authMode).toBe(null)
    expect(favoritesUiStore.alertDialog.visible).toBe(true)
    expect(favoritesUiStore.alertDialog.message).toBe(
      'There was a problem starting your session. Please try again.',
    )
  })

  it('recovers to unauthenticated when bootstrapping an already logged-in session fails', async () => {
    const pinia = createPinia()
    const appStore = useAppStore(pinia)
    const authStore = useAuthStore(pinia)
    const favoritesStore = useFavoritesStore(pinia)
    const favoritesUiStore = useFavoritesUiStore(pinia)

    authStore.continueInLocalMode()
    vi.spyOn(favoritesStore, 'initializeForCurrentSession').mockRejectedValue(
      new Error('Google favorites require a user id.'),
    )

    await expect(appStore.bootstrap()).resolves.toBeUndefined()

    expect(appStore.status).toBe('unauthenticated')
    expect(appStore.isBootstrapped).toBe(true)
    expect(authStore.authMode).toBe(null)
    expect(favoritesUiStore.alertDialog.visible).toBe(true)
  })
})
