import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import LoginPage from '../components/auth/LoginPage.vue'
import i18n from '../i18n'
import { initializeLocale } from '../services/locale'
import { resetLocalStorageMock } from './mocks/localStorage'
import { resetPocketbaseMocks } from './mocks/pocketbase'

describe('Locale initialization', () => {
  beforeEach(() => {
    resetLocalStorageMock()
    resetPocketbaseMocks()
  })

  it('renders the login page in the persisted locale on first paint', () => {
    localStorage.setItem('groovemark_locale', 'en')
    initializeLocale()

    const wrapper = mount(LoginPage, {
      global: {
        plugins: [createPinia(), i18n],
      },
    })

    expect(wrapper.text()).toContain('Welcome to GrooveMark')
  })
})
