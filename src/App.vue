<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AlertDialog from './components/modals/AlertDialog.vue'
import ConfirmDialog from './components/modals/ConfirmDialog.vue'
import LoginPage from './components/auth/LoginPage.vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()

onMounted(async () => {
  await appStore.bootstrap()
})
</script>

<template>
  <div
    v-if="appStore.status === 'booting'"
    class="flex min-h-screen items-center justify-center bg-gray-50 p-6"
  >
    <div class="text-center">
      <img src="/icon.svg" alt="GrooveMark Logo" class="mx-auto mb-4 h-16 w-16 animate-pulse" />
      <p class="text-sm font-medium tracking-wide text-gray-500 uppercase">
        {{ $t('app.loading') }}
      </p>
    </div>
  </div>

  <LoginPage v-else-if="appStore.status === 'unauthenticated'" />

  <!-- The boot state machine stays the outer gate: a destination only renders
       once the session is ready. -->
  <div v-else class="app-shell">
    <RouterView />
  </div>

  <AlertDialog />
  <ConfirmDialog />
</template>

<style scoped></style>
