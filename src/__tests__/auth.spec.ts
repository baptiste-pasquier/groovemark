import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/auth'
import '../__tests__/mocks/pocketbase'

// Mock localStorage
const localStorageMock: Record<string, string> = {}
global.localStorage = {
  getItem: vi.fn((key: string) => localStorageMock[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock[key]
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageMock).forEach((key) => delete localStorageMock[key])
  }),
  key: vi.fn(),
  length: 0,
}

describe('Auth Store', () => {
  beforeEach(() => {
    // Create a fresh pinia instance for each test
    setActivePinia(createPinia())
    // Clear localStorage mock and reset mocks
    localStorage.clear()
    vi.clearAllMocks()
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
    expect(localStorageMock['groovemark_auth_mode']).toBe('local')
  })

  it('persists auth mode in localStorage', () => {
    const authStore = useAuthStore()
    authStore.continueInLocalMode()

    expect(localStorage.setItem).toHaveBeenCalledWith('groovemark_auth_mode', 'local')
  })

  it('can sign out', async () => {
    const authStore = useAuthStore()
    authStore.continueInLocalMode()

    expect(authStore.isLoggedIn).toBe(true)

    await authStore.signOut()

    expect(authStore.authMode).toBe(null)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.isLoggedIn).toBe(false)
    expect(localStorageMock['groovemark_auth_mode']).toBeUndefined()
  })

  it('restores local mode from localStorage', async () => {
    // Simulate stored auth mode
    localStorageMock['groovemark_auth_mode'] = 'local'

    const authStore = useAuthStore()
    await authStore.initialize()

    expect(authStore.authMode).toBe('local')
    expect(authStore.isLoggedIn).toBe(true)
  })
})
