<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, LogOut } from 'lucide-vue-next'
import AppMenuItems from './AppMenuItems.vue'
import { useAppStore } from '../../stores/app'
import { useAuthStore } from '../../stores/auth'
import { useFavoritesStore } from '../../stores/favorites'

// Local mode has no account, so it has no account menu: a settings button and
// a warning badge stay two separate things, as they are today. What it does
// need is a way out -- leaving local mode is the only route back to the
// sign-in screen, so it lives here rather than disappearing with the red
// button this menu replaces.
//
// Local mode never syncs, and it is never read-only either: every local
// repository swallows its own storage error instead of throwing (readStorage
// catches and returns null), so useAppStore.isReadOnly -- the single
// read-only switch -- never turns true for a local session. The only state
// worth signalling on this trigger is an import in progress, the same way
// AccountMenu signals it.
const appStore = useAppStore()
const authStore = useAuthStore()
const favoritesStore = useFavoritesStore()

const { t } = useI18n()

const isMenuOpen = ref(false)

const isImporting = computed(() => Boolean(favoritesStore.importProgress))

const statusLabel = computed(() => {
  const progress = favoritesStore.importProgress
  if (!progress) return ''
  return progress.total === null
    ? t('app.importing_preparing')
    : t('app.importing', { processed: progress.processed, total: progress.total })
})

async function handleExitLocalMode() {
  isMenuOpen.value = false
  await authStore.signOut()
  appStore.handleSignedOut()
}
</script>

<template>
  <div class="relative">
    <button
      id="settings-menu-btn"
      type="button"
      class="relative rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
      :title="t('app.settings')"
      aria-haspopup="true"
      :aria-expanded="isMenuOpen"
      @click="isMenuOpen = !isMenuOpen"
    >
      <Settings class="h-6 w-6 text-gray-700" />
      <span
        v-if="isImporting"
        data-local-mode-status="importing"
        aria-hidden="true"
        class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-blue-500 ring-2 ring-[#f0f2f5]"
      ></span>
      <span class="sr-only" role="status">{{ statusLabel }}</span>
    </button>

    <div
      v-if="isMenuOpen"
      data-menu-backdrop
      class="fixed inset-0 z-10 cursor-default"
      @click="isMenuOpen = false"
    ></div>

    <div v-if="isMenuOpen" class="header-menu-panel" role="menu">
      <AppMenuItems @done="isMenuOpen = false" />
      <div class="my-1 border-t border-gray-100"></div>
      <button
        id="exit-local-mode-btn"
        class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
        role="menuitem"
        @click="handleExitLocalMode"
      >
        <LogOut class="h-4 w-4" />
        {{ t('auth.exit_local_mode') }}
      </button>
    </div>
  </div>
</template>
