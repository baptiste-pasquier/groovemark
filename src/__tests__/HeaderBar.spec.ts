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
  })

  it('carries no list control at all, on any destination', async () => {
    const router = createTestRouter()

    for (const destination of ['/', '/events', '/artists']) {
      await router.push(destination)
      await router.isReady()

      const wrapper = mountHeaderBar(router)
      expect(wrapper.find('#sort-btn').exists()).toBe(false)
      expect(wrapper.find('#filter-menu-btn').exists()).toBe(false)
    }
  })

  it('emits nothing, so no destination view has to wire a header control up', () => {
    const wrapper = mountHeaderBar()

    expect(Object.keys(wrapper.vm.$options.emits ?? {})).toEqual([])
  })

  it('gives a signed-in session one identity control and no loose buttons', () => {
    const authStore = useAuthStore()
    authStore.authMode = 'google'
    authStore.user = createUser('user-1')

    const wrapper = mountHeaderBar()

    expect(wrapper.find('#account-menu-btn').exists()).toBe(true)
    expect(wrapper.find('#settings-menu-btn').exists()).toBe(false)
    expect(wrapper.find('#logout-btn').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Local Mode')
  })

  it('gives local mode a warning badge and a settings menu, and no account control', () => {
    const authStore = useAuthStore()
    authStore.continueInLocalMode()

    const wrapper = mountHeaderBar()

    expect(wrapper.text()).toContain('Local Mode')
    expect(wrapper.find('#settings-menu-btn').exists()).toBe(true)
    expect(wrapper.find('#account-menu-btn').exists()).toBe(false)
  })

  it('keeps an identity control on every destination', async () => {
    const authStore = useAuthStore()
    authStore.authMode = 'google'
    authStore.user = createUser('user-1')

    const router = createTestRouter()

    for (const destination of ['/', '/events', '/artists']) {
      await router.push(destination)
      await router.isReady()

      const wrapper = mountHeaderBar(router)
      expect(wrapper.find('#account-menu-btn').exists()).toBe(true)
    }
  })

  it('hides the subtitle below sm, where the row is the scarce thing', () => {
    const wrapper = mountHeaderBar()
    const subtitle = wrapper.get('[data-app-subtitle]')

    expect(subtitle.text()).toBe('Save your favorite mixes and their highlights.')
    expect(subtitle.classes()).toContain('hidden')
    expect(subtitle.classes()).toContain('sm:block')
  })

  it('mounts the identity exactly once, so no control beneath it has a duplicated id', () => {
    const authStore = useAuthStore()
    authStore.authMode = 'google'
    authStore.user = createUser('user-1')

    const wrapper = mountHeaderBar()

    expect(wrapper.findAll('#account-menu-btn')).toHaveLength(1)
  })

  it('orders the header brand, identity and tabs so the tabs wrap to their own row below sm', () => {
    const wrapper = mountHeaderBar()

    const brand = wrapper.get('[data-header-slot="brand"]')
    const identity = wrapper.get('[data-header-slot="identity"]')
    const tabs = wrapper.get('[data-header-slot="tabs"]')

    // All three are siblings of one wrapping row: that is what lets order and
    // basis do the repositioning instead of a hidden/visible pair.
    expect(identity.element.parentElement).toBe(brand.element.parentElement)
    expect(tabs.element.parentElement).toBe(brand.element.parentElement)

    // Below sm the tabs take the full basis and wrap; from sm the identity is
    // pushed past them to the end of the single row.
    expect(tabs.classes()).toContain('basis-full')
    expect(tabs.classes()).toContain('sm:basis-auto')
    expect(identity.classes()).toContain('sm:order-last')
  })
})
