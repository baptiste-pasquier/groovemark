<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useI18n } from 'vue-i18n'

const authStore = useAuthStore()
const { t } = useI18n()
const isLoading = ref(false)
const errorMessage = ref('')

async function handleGoogleSignIn() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    await authStore.signInWithGoogle()
  } catch (error) {
    console.error('Google sign-in error:', error)
    errorMessage.value = error instanceof Error ? error.message : t('login.error_google_signin')
  } finally {
    isLoading.value = false
  }
}

function handleLocalMode() {
  authStore.continueInLocalMode()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-900 p-4">
    <div class="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-2xl">
      <!-- Logo/Title -->
      <div class="mb-8 text-center">
        <h1 class="mb-4 text-3xl font-bold text-white">{{ t('login.welcome') }}</h1>
        <p class="mt-2 text-gray-400">{{ t('app.subtitle') }}</p>
      </div>

      <!-- Error Message -->
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        :description="errorMessage"
        class="mb-6"
      />

      <!-- Sign in with Google Button -->
      <UButton
        block
        size="xl"
        color="neutral"
        variant="solid"
        :loading="isLoading"
        :disabled="isLoading"
        @click="handleGoogleSignIn"
        class="mb-4"
      >
        <template #leading>
          <svg v-if="!isLoading" class="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        </template>
        {{ isLoading ? t('login.signing_in') : t('login.signin_google') }}
      </UButton>

      <!-- Divider -->
      <div class="relative my-6">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-600"></div>
        </div>
        <div class="relative flex justify-center text-sm">
          <span class="bg-gray-800 px-4 text-gray-400">{{ t('login.or') }}</span>
        </div>
      </div>

      <!-- Continue in Local Mode Button -->
      <UButton
        block
        size="xl"
        color="neutral"
        variant="outline"
        :disabled="isLoading"
        @click="handleLocalMode"
      >
        {{ t('login.continue_local') }}
      </UButton>

      <!-- Info about local mode -->
      <p class="mt-4 text-center text-xs text-gray-500">
        {{ t('login.local_mode_info') }}
      </p>
    </div>
  </div>
</template>
