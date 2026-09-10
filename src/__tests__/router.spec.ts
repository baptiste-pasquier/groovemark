import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import MixesView from '../components/favorites/MixesView.vue'
import i18n from '../i18n'
import { routes } from '../router'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = []
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

function createTestRouter(): Router {
  return createRouter({ history: createMemoryHistory(), routes })
}

describe('router', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('keeps the destination switcher on screen at every declared address', async () => {
    const addresses = ['/', '/events', '/artists', '/artists/anetha']

    for (const address of addresses) {
      const router = createTestRouter()
      await router.push(address)
      await router.isReady()

      const wrapper = mount(RouterView, { global: { plugins: [i18n, router] } })

      expect(wrapper.findAll('[data-destination]').map((tab) => tab.text())).toEqual([
        'Mixes',
        'Events',
        'Artists',
      ])
      wrapper.unmount()
    }
  })

  it('resolves each top-level destination to the route the table names', async () => {
    const router = createTestRouter()
    const destinations = [
      ['/', 'mixes'],
      ['/events', 'events'],
      ['/artists', 'artists'],
    ] as const

    for (const [path, name] of destinations) {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe(name)
    }
  })

  it('renders the mixes view at the start address', async () => {
    const router = createTestRouter()

    await router.push('/')

    expect(router.currentRoute.value.matched[0]?.components?.default).toBe(MixesView)
  })

  it('resolves an artist address to the artist page with its slug parameter', async () => {
    const router = createTestRouter()

    await router.push('/artists/anetha')

    expect(router.currentRoute.value.name).toBe('artist')
    expect(router.currentRoute.value.params.slug).toBe('anetha')
  })

  it('decodes an artist slug carrying a slash or a space', async () => {
    const router = createTestRouter()

    await router.push('/artists/AC%2FDC')
    expect(router.currentRoute.value.name).toBe('artist')
    expect(router.currentRoute.value.params.slug).toBe('AC/DC')

    await router.push('/artists/daft%20punk')
    expect(router.currentRoute.value.name).toBe('artist')
    expect(router.currentRoute.value.params.slug).toBe('daft punk')
  })

  it('percent-encodes a slug when an artist address is built from the named route', () => {
    const router = createTestRouter()

    expect(router.resolve({ name: 'artist', params: { slug: 'AC/DC' } }).href).toBe(
      '/artists/AC%2FDC',
    )
    expect(router.resolve({ name: 'artist', params: { slug: 'daft punk' } }).href).toBe(
      '/artists/daft%20punk',
    )
  })

  it('sends an unrecognized address to the mixes destination', async () => {
    const router = createTestRouter()

    await router.push('/not/a/destination')

    expect(router.currentRoute.value.name).toBe('mixes')
    expect(router.currentRoute.value.matched[0]?.components?.default).toBe(MixesView)
  })
})
