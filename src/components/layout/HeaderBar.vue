<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from 'lucide-vue-next'
import AccountMenu from './AccountMenu.vue'
import LocalModeMenu from './LocalModeMenu.vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()

const { t } = useI18n()
const route = useRoute()

const DESTINATIONS = [
  { name: 'mixes', label: 'nav.mixes' },
  { name: 'events', label: 'nav.events' },
  { name: 'artists', label: 'nav.artists' },
] as const

// The artist page belongs to the artists destination, so its tab stays marked
// while an artist page is open.
const activeDestination = computed(() => (route.name === 'artist' ? 'artists' : route.name))
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
        <span
          v-if="authStore.authMode === 'local'"
          class="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
          :title="t('login.local_mode_info')"
        >
          <TriangleAlert class="h-4 w-4" />
          {{ t('auth.local_mode') }}
        </span>
        <LocalModeMenu v-if="authStore.authMode === 'local'" />
        <AccountMenu v-else />
      </div>
    </div>
  </header>
</template>
