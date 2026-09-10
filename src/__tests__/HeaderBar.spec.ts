import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { RecordModel } from 'pocketbase'
import HeaderBar from '../components/layout/HeaderBar.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

function createUser(id: string): RecordModel {
  return {
    id,
    collectionId: 'users',
    collectionName: 'users',
    name: `User ${id}`,
    email: `${id}@example.com`,
  }
}

function createTestRouter(): Router {
  return createRouter({ history: createMemoryHistory(), routes })
}

function mountHeaderBar(router: Router = createTestRouter()) {
  return mount(HeaderBar, {
    global: { plugins: [i18n, router] },
  })
}

describe('HeaderBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('shows the offline read-only badge and disables import when the cache fallback is active', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.user = createUser('user-1')
    favoritesStore.repositoryMode = 'google-cache'

    const wrapper = mountHeaderBar()
    await wrapper.find('#settings-menu-btn').trigger('click')

    expect(wrapper.text()).toContain('Offline (Read-only)')
    expect(wrapper.find('#import-json').attributes('disabled')).toBeDefined()
  })

  it('renders the three destination tabs and marks the current one', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mountHeaderBar(router)
    const tabs = wrapper.findAll('[data-destination]')

    expect(tabs.map((tab) => tab.text())).toEqual(['Mixes', 'Events', 'Artists'])
    expect(wrapper.get('[data-destination="mixes"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-destination="events"]').attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('[data-destination="artists"]').attributes('aria-current')).toBeUndefined()
  })

  it('switches destination when a tab is clicked', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mountHeaderBar(router)

    await wrapper.get('[data-destination="events"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('events')
    expect(wrapper.get('[data-destination="events"]').attributes('aria-current')).toBe('page')
    expect(wrapper.get('[data-destination="mixes"]').attributes('aria-current')).toBeUndefined()

    await wrapper.get('[data-destination="artists"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('artists')
    expect(wrapper.get('[data-destination="artists"]').attributes('aria-current')).toBe('page')
  })

  it('marks the artists tab while an artist page is open', async () => {
    const router = createTestRouter()
    await router.push({ name: 'artist', params: { slug: 'AC/DC' } })
    await router.isReady()

    const wrapper = mountHeaderBar(router)

    expect(wrapper.get('[data-destination="artists"]').attributes('aria-current')).toBe('page')
  })

  it('uses the documented switcher classes so the tabs collapse to full width below md', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mountHeaderBar(router)
    const nav = wrapper.get('nav')

    expect(nav.attributes('aria-label')).toBe('Main sections')
    expect(nav.classes()).toContain('destination-switcher')
    wrapper.findAll('[data-destination]').forEach((tab) => {
      expect(tab.classes()).toContain('destination-tab')
    })
    expect(wrapper.get('#sort-btn').element.closest('.favorites-header-controls')).not.toBeNull()
  })

  it('offers the grid sort and artist filter on the mixes destination only', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()

    const wrapper = mountHeaderBar(router)
    expect(wrapper.find('#sort-btn').exists()).toBe(true)
    expect(wrapper.find('#filter-menu-btn').exists()).toBe(true)

    for (const destination of ['/events', '/artists']) {
      await router.push(destination)
      await flushPromises()
      expect(wrapper.find('#sort-btn').exists()).toBe(false)
      expect(wrapper.find('#filter-menu-btn').exists()).toBe(false)
    }
  })

  it('keeps the app-level settings menu on every destination', async () => {
    const router = createTestRouter()

    for (const destination of ['/', '/events', '/artists']) {
      await router.push(destination)
      await router.isReady()

      const wrapper = mountHeaderBar(router)
      expect(wrapper.find('#settings-menu-btn').exists()).toBe(true)
    }
  })

  it('does not show the offline badge when signed in online', async () => {
    const authStore = useAuthStore()
    const favoritesStore = useFavoritesStore()

    authStore.authMode = 'google'
    authStore.user = createUser('user-1')
    favoritesStore.repositoryMode = 'google-cloud'

    const wrapper = mountHeaderBar()
    await wrapper.find('#settings-menu-btn').trigger('click')

    expect(wrapper.text()).not.toContain('Offline (Read-only)')
    expect(wrapper.find('#import-json').attributes('disabled')).toBeUndefined()
  })
})
