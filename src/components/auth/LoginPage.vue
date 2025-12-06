<script setup lang="ts">
import { useAuthStore } from '../../stores/auth'
import { useI18n } from 'vue-i18n'

const authStore = useAuthStore()
const { t } = useI18n()

async function handleGoogleLogin() {
  try {
    await authStore.loginWithGoogle()
  } catch (error) {
    console.error('Login failed', error)
    // Ideally show an error message to the user
  }
}

function handleLocalMode() {
  authStore.enableLocalMode()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-900 px-4">
    <div class="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-lg">
      <div class="mb-8 text-center">
        <h1 class="mb-2 text-3xl font-bold text-white">{{ t('auth.welcome') }}</h1>
        <p class="text-gray-400">{{ t('app.subtitle') }}</p>
      </div>

      <div class="space-y-4">
        <button
          @click="handleGoogleLogin"
          class="flex w-full items-center justify-center rounded-lg bg-white px-4 py-3 font-medium text-gray-900 transition hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-none"
        >
          <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {{ t('auth.login_with_google') }}
        </button>

        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-600"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="bg-gray-800 px-2 text-gray-400">Or</span>
          </div>
        </div>

        <button
          @click="handleLocalMode"
          class="w-full rounded-lg border border-gray-600 bg-transparent px-4 py-3 font-medium text-gray-300 transition hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800 focus:outline-none"
        >
          {{ t('auth.continue_local') }}
        </button>

        <p class="text-center text-xs text-gray-500">
          {{ t('auth.local_mode_warning') }}
        </p>
      </div>
    </div>
  </div>
</template>
