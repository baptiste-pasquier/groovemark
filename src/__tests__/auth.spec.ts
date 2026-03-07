import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/pocketbase'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import { getLocalStorageState, resetLocalStorageMock } from './mocks/localStorage'
import { resetPocketbaseMocks } from './mocks/pocketbase'

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLocalStorageMock()
    resetPocketbaseMocks()
  })

  it('initializes with no auth mode', () => {
    const authStore = useAuthStore()
    expect(authStore.authMode).toBe(null)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.isLoggedIn).toBe(false)
  })

  it('can set local mode', () => {
    const authStore = useAuthStore()
    authStore.continueInLocalMode()

    expect(authStore.authMode).toBe('local')
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.isLoggedIn).toBe(true)
    expect(getLocalStorageState().groovemark_auth_mode).toBe('local')
  })

  it('can sign out', async () => {
    const authStore = useAuthStore()
    authStore.continueInLocalMode()

    await authStore.signOut()

    expect(authStore.authMode).toBe(null)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.isLoggedIn).toBe(false)
    expect(getLocalStorageState().groovemark_auth_mode).toBeUndefined()
  })

  it('restores local mode from storage', async () => {
    localStorage.setItem('groovemark_auth_mode', 'local')

    const authStore = useAuthStore()
    await authStore.initialize()

    expect(authStore.authMode).toBe('local')
    expect(authStore.isLoggedIn).toBe(true)
  })
})
