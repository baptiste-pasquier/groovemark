import { defineStore } from 'pinia'
import { ref } from 'vue'
import pb from '../services/pocketbase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(pb.authStore.model)
  const isLocalMode = ref(localStorage.getItem('localMode') === 'true')

  // Update user when auth state changes
  pb.authStore.onChange((token, model) => {
    user.value = model
  })

  async function loginWithGoogle() {
    try {
      const authData = await pb.collection('users').authWithOAuth2({ provider: 'google' })
      user.value = authData.record
      isLocalMode.value = false
      localStorage.removeItem('localMode')
    } catch (error) {
      console.error('Failed to login with Google:', error)
      throw error
    }
  }

  function logout() {
    pb.authStore.clear()
    user.value = null
  }

  function enableLocalMode() {
    isLocalMode.value = true
    localStorage.setItem('localMode', 'true')
  }

  function disableLocalMode() {
    isLocalMode.value = false
    localStorage.removeItem('localMode')
  }

  return {
    user,
    isLocalMode,
    loginWithGoogle,
    logout,
    enableLocalMode,
    disableLocalMode,
  }
})
