import { describe, it, expect, beforeEach, vi } from 'vitest'
import './mocks/pocketbase'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppMenuItems from '../components/layout/AppMenuItems.vue'
import i18n from '../i18n'
import { LOCALE_STORAGE_KEY } from '../services/storage'
import { useFavoritesStore } from '../stores/favorites'
import { resetPocketbaseMocks } from './mocks/pocketbase'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'

function mountAppMenuItems() {
  return mount(AppMenuItems, { global: { plugins: [i18n] } })
}

describe('AppMenuItems', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetPocketbaseMocks()
    resetLocalStorageMock()
    i18n.global.locale.value = 'en'
  })

  it('does not disable import in a healthy session', () => {
    const wrapper = mountAppMenuItems()

    expect(wrapper.find('#import-json').attributes('disabled')).toBeUndefined()
  })

  it('disables import when the session fell back to the read-only cache', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.repositoryMode = 'google-cache'

    const wrapper = mountAppMenuItems()

    expect(wrapper.find('#import-json').attributes('disabled')).toBeDefined()
  })

  it('disables import while one is already running', () => {
    const favoritesStore = useFavoritesStore()
    favoritesStore.importProgress = { processed: 12, total: 80 }

    const wrapper = mountAppMenuItems()

    expect(wrapper.find('#import-json').attributes('disabled')).toBeDefined()
  })

  it('runs the import with the selected file and emits done', async () => {
    const favoritesStore = useFavoritesStore()
    const importFromFile = vi
      .spyOn(favoritesStore, 'importFromFile')
      .mockResolvedValue({ added: 0, skipped: 0, failed: 0 })

    const wrapper = mountAppMenuItems()
    const input = wrapper.find('#import-json')
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })

    await input.trigger('change')
    await flushPromises()

    expect(importFromFile).toHaveBeenCalledTimes(1)
    expect(importFromFile.mock.calls[0]?.[0]).toBe(file)
    expect(wrapper.emitted('done')).toHaveLength(1)
  })

  it('clears the input value after an import, so the same file fires change again', async () => {
    const favoritesStore = useFavoritesStore()
    vi.spyOn(favoritesStore, 'importFromFile').mockResolvedValue({
      added: 0,
      skipped: 0,
      failed: 0,
    })

    const wrapper = mountAppMenuItems()
    const input = wrapper.find('#import-json')
    const file = new File(['{}'], 'backup.json', { type: 'application/json' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })

    await input.trigger('change')
    await flushPromises()

    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('exports favorites and emits done', async () => {
    const favoritesStore = useFavoritesStore()
    const exportFavorites = vi
      .spyOn(favoritesStore, 'exportFavorites')
      .mockImplementation(async () => {})

    const wrapper = mountAppMenuItems()
    await wrapper.get('#export-json-btn').trigger('click')

    expect(exportFavorites).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('done')).toHaveLength(1)
  })

  it('persists a chosen locale through storage, not only the reactive ref, and emits done', async () => {
    const wrapper = mountAppMenuItems()
    const buttons = wrapper.findAll('button[role="menuitem"]')
    const frenchButton = buttons.find((button) => button.text() === 'Français')

    await frenchButton?.trigger('click')

    expect(i18n.global.locale.value).toBe('fr')
    expect(getLocalStorageState()[LOCALE_STORAGE_KEY]).toBe('fr')
    expect(wrapper.emitted('done')).toHaveLength(1)
  })
})
