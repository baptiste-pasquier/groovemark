import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import HeaderBar from '../components/layout/HeaderBar.vue'
import i18n from '../i18n'
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

function mountHeaderBar() {
  return mount(HeaderBar, {
    global: { plugins: [i18n] },
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
