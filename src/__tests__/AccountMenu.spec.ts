import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { RecordModel } from 'pocketbase'
import AccountMenu from '../components/layout/AccountMenu.vue'
import i18n from '../i18n'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'
import { useFavoritesStore } from '../stores/favorites'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { resetLocalStorageMock } from './mocks/localStorage'

function createUser(overrides: Partial<RecordModel> = {}): RecordModel {
  return {
    id: 'user-1',
    collectionId: 'users',
    collectionName: 'users',
    name: 'Baptiste Pasquier',
    email: 'baptiste@example.com',
    avatar: 'photo.jpg',
    ...overrides,
  } as RecordModel
}

function mountAccountMenu() {
  return mount(AccountMenu, { global: { plugins: [i18n] } })
}

function signIn(user: RecordModel = createUser()) {
  const authStore = useAuthStore()
  authStore.authMode = 'google'
  authStore.user = user
  return authStore
}

describe('AccountMenu', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('renders the Google photo when the record carries one', () => {
    signIn()

    const wrapper = mountAccountMenu()
    const image = wrapper.get('img')

    expect(image.attributes('src')).toBe(
      'https://pb.test/api/files/users/user-1/photo.jpg?thumb=100x100',
    )
  })

  it('falls back to the initial when the record carries no avatar', () => {
    signIn(createUser({ avatar: '' }))

    const wrapper = mountAccountMenu()

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('#account-menu-btn').get('span.grid').text()).toBe('B')
  })

  it('falls back to the initial when the photo fails to load', async () => {
    signIn()

    const wrapper = mountAccountMenu()
    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('#account-menu-btn').get('span.grid').text()).toBe('B')
  })

  it('shows a green dot on a healthy session', () => {
    signIn()

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('data-account-status')).toBe('synced')
  })

  it('shows an amber dot when the session fell back to the read-only cache', () => {
    signIn()
    const favoritesStore = useFavoritesStore()
    favoritesStore.repositoryMode = 'google-cache'

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('data-account-status')).toBe('readonly')
  })

  it('shows a blue dot while an import is running, ahead of every other state', () => {
    signIn()
    const favoritesStore = useFavoritesStore()
    favoritesStore.repositoryMode = 'google-cache'
    favoritesStore.importProgress = { processed: 12, total: 80 }

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('data-account-status')).toBe('importing')
  })

  it('announces the running import to assistive technology, ahead of the dot which is decorative', () => {
    signIn()
    const favoritesStore = useFavoritesStore()
    favoritesStore.importProgress = { processed: 12, total: 80 }

    const wrapper = mountAccountMenu()

    expect(wrapper.get('[data-account-status]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toBe('Importing... (12/80)')
  })

  it('names the account and its state only once the panel is open', async () => {
    signIn()

    const wrapper = mountAccountMenu()
    expect(wrapper.text()).not.toContain('baptiste@example.com')

    await wrapper.get('#account-menu-btn').trigger('click')

    expect(wrapper.text()).toContain('baptiste@example.com')
    expect(wrapper.text()).toContain('Synced')
  })

  it('carries the app actions and signs out', async () => {
    const authStore = signIn()
    const appStore = useAppStore()
    const handleSignedOut = vi.spyOn(appStore, 'handleSignedOut').mockImplementation(() => {})

    const wrapper = mountAccountMenu()
    await wrapper.get('#account-menu-btn').trigger('click')

    expect(wrapper.find('#import-json').exists()).toBe(true)
    expect(wrapper.find('#export-json-btn').exists()).toBe(true)

    await wrapper.get('#logout-btn').trigger('click')
    await flushPromises()

    expect(authStore.authMode).toBeNull()
    expect(handleSignedOut).toHaveBeenCalledTimes(1)
  })
})
