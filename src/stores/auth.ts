import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import pb from '../services/pocketbase'
import type { RecordModel } from 'pocketbase'

export type AuthMode = 'google' | 'local' | null

interface AuthProviderInfo {
  name: string
  displayName: string
  state: string
  authURL: string
  codeVerifier: string
  codeChallengeMethod: string
  codeChallenge: string
}

export const useAuthStore = defineStore('auth', () => {
  const authMode = ref<AuthMode>(null)
  const isAuthenticated = ref(false)
  const user = ref<RecordModel | null>(null)
  const isInitialized = ref(false)

  const AUTH_MODE_KEY = 'groovemark_auth_mode'

  // Check if user is authenticated (either Google or local mode)
  const isLoggedIn = computed(() => {
    return authMode.value !== null
  })

  // Initialize authentication state from storage
  async function initialize() {
    if (isInitialized.value) return
    isInitialized.value = true

    try {
      // Check for stored auth mode
      const storedMode = localStorage.getItem(AUTH_MODE_KEY) as AuthMode

      if (storedMode === 'local') {
        // User chose local mode
        authMode.value = 'local'
        isAuthenticated.value = false
        return
      }

      // Check if user has an active PocketBase session
      if (pb.authStore.isValid && pb.authStore.model) {
        authMode.value = 'google'
        isAuthenticated.value = true
        user.value = pb.authStore.model
        return
      }

      // No authentication
      authMode.value = null
      isAuthenticated.value = false
    } catch (error) {
      console.error('Error initializing auth:', error)
      authMode.value = null
      isAuthenticated.value = false
    }
  }

  // Sign in with Google OAuth
  async function signInWithGoogle() {
    try {
      // Get OAuth2 providers from PocketBase
      const authMethods = await pb.collection('users').listAuthMethods()

      // Find Google provider
      const googleProvider = authMethods.oauth2.providers.find(
        (provider: AuthProviderInfo) => provider.name === 'google',
      )

      if (!googleProvider) {
        throw new Error('Google OAuth provider not configured in PocketBase')
      }

      // Start OAuth flow
      const authData = await pb.collection('users').authWithOAuth2({
        provider: 'google',
      })

      if (authData) {
        authMode.value = 'google'
        isAuthenticated.value = true
        user.value = authData.record
        localStorage.setItem(AUTH_MODE_KEY, 'google')
        return true
      }
      return false
    } catch (error) {
      console.error('Error signing in with Google:', error)
      throw error
    }
  }

  // Continue in local mode (no authentication)
  function continueInLocalMode() {
    authMode.value = 'local'
    isAuthenticated.value = false
    user.value = null
    localStorage.setItem(AUTH_MODE_KEY, 'local')
  }

  // Sign out
  async function signOut() {
    try {
      if (authMode.value === 'google') {
        pb.authStore.clear()
      }
      authMode.value = null
      isAuthenticated.value = false
      user.value = null
      localStorage.removeItem(AUTH_MODE_KEY)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return {
    authMode,
    isAuthenticated,
    user,
    isLoggedIn,
    isInitialized,
    initialize,
    signInWithGoogle,
    continueInLocalMode,
    signOut,
  }
})
