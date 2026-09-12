<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Settings, TriangleAlert, LogOut, LoaderCircle } from 'lucide-vue-next'
import AppMenuItems from './AppMenuItems.vue'
import LocalModeMenu from './LocalModeMenu.vue'
import { useAuthStore } from '../../stores/auth'
import { useAppStore } from '../../stores/app'
import { useFavoritesStore } from '../../stores/favorites'

const favoritesStore = useFavoritesStore()
const authStore = useAuthStore()
const appStore = useAppStore()

const { t } = useI18n()
const route = useRoute()

const isMenuOpen = ref(false)

const DESTINATIONS = [
  { name: 'mixes', label: 'nav.mixes' },
  { name: 'events', label: 'nav.events' },
  { name: 'artists', label: 'nav.artists' },
] as const

// The artist page belongs to the artists destination, so its tab stays marked
// while an artist page is open.
const activeDestination = computed(() => (route.name === 'artist' ? 'artists' : route.name))

// Compute display name for auth status
const authDisplayName = computed(() => {
  if (authStore.authMode === 'google' && authStore.user) {
    return authStore.user.name || authStore.user.email || 'User'
  }
  return t('auth.local_mode')
})

const importingLabel = computed(() => {
  const progress = favoritesStore.importProgress
  if (!progress) return ''
  if (progress.total === null) return t('app.importing_preparing')
  return t('app.importing', { processed: progress.processed, total: progress.total })
})

async function handleLogout() {
  await authStore.signOut()
  appStore.handleSignedOut()
  isMenuOpen.value = false
}
</script>

<template>
  <header class="favorites-header">
    <div class="flex items-center gap-4">
      <img src="/icon.svg" alt="GrooveMark Logo" class="h-16 w-16" />
      <div>
        <h1 class="text-4xl font-bold text-gray-900">{{ t('app.title') }}</h1>
        <p class="text-gray-600">{{ t('app.subtitle') }}</p>
      </div>
    </div>
    <div class="mt-4 flex flex-col items-center gap-3 sm:mt-0 sm:items-end">
      <div class="flex items-center gap-2 text-sm font-medium">
        <span
          v-if="favoritesStore.importProgress"
          class="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700"
        >
          <LoaderCircle class="h-4 w-4 animate-spin" />
          {{ importingLabel }}
        </span>
        <span
          v-if="authStore.authMode === 'local'"
          class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700"
          :title="t('login.local_mode_info')"
        >
          <TriangleAlert class="h-4 w-4" />
          {{ t('auth.local_mode') }}
        </span>
        <span
          v-else-if="favoritesStore.isReadOnly"
          class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700"
          :title="t('login.offline_read_only_info')"
        >
          <TriangleAlert class="h-4 w-4" />
          {{ t('auth.offline_read_only') }}
        </span>
        <span
          v-else
          class="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700"
        >
          <span class="h-2 w-2 rounded-full bg-green-500"></span>
          {{ authDisplayName }}
        </span>
      </div>
      <div class="favorites-header-controls">
        <nav class="destination-switcher" :aria-label="t('nav.aria_label')">
          <RouterLink
            v-for="destination in DESTINATIONS"
            :key="destination.name"
            :to="{ name: destination.name }"
            :data-destination="destination.name"
            class="destination-tab"
            :class="{ 'destination-tab-active': activeDestination === destination.name }"
            :aria-current="activeDestination === destination.name ? 'page' : undefined"
          >
            {{ t(destination.label) }}
          </RouterLink>
        </nav>
        <LocalModeMenu v-if="authStore.authMode === 'local'" />
        <div v-else class="relative">
          <button
            id="settings-menu-btn"
            class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
            @click="isMenuOpen = !isMenuOpen"
            :title="t('app.settings')"
            aria-haspopup="true"
            :aria-expanded="isMenuOpen"
          >
            <Settings class="h-6 w-6 text-gray-700" />
          </button>

          <!-- Backdrop to close menu -->
          <div
            v-if="isMenuOpen"
            class="fixed inset-0 z-10 cursor-default"
            @click="isMenuOpen = false"
          ></div>

          <!-- Menu Dropdown -->
          <div
            v-if="isMenuOpen"
            class="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-md border border-gray-300 bg-white py-1 shadow-xl focus:outline-none"
            role="menu"
          >
            <AppMenuItems @done="isMenuOpen = false" />
          </div>
        </div>
        <button
          v-if="authStore.authMode !== 'local'"
          id="logout-btn"
          class="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-red-600 focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:outline-none"
          @click="handleLogout"
          :title="
            authStore.authMode === 'google'
              ? t('auth.signed_in_as', { name: authDisplayName })
              : authDisplayName
          "
        >
          <LogOut class="h-4 w-4" />
          {{ t('auth.logout') }}
        </button>
      </div>
    </div>
  </header>
</template>
