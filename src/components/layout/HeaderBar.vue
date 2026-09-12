<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeaderIdentity from './HeaderIdentity.vue'

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
    <div data-header-slot="brand" class="flex min-w-0 flex-1 items-center gap-4">
      <img src="/icon.svg" alt="GrooveMark Logo" class="h-16 w-16 shrink-0" />
      <div class="min-w-0">
        <h1 class="text-4xl font-bold text-gray-900">{{ t('app.title') }}</h1>
        <p data-app-subtitle class="hidden text-gray-600 sm:block">{{ t('app.subtitle') }}</p>
      </div>
    </div>

    <!-- One mount, two positions. Below sm the tabs take the full basis and
         wrap to their own row, leaving the identity beside the title; from sm
         the row is single and order-last pushes the identity past the tabs to
         the end. Mounting it twice behind a hidden/visible pair would put
         every id beneath it in the document twice -- and the import control is
         a <label for> bound to an <input id>, which a duplicate id breaks. -->
    <div
      data-header-slot="identity"
      class="relative flex shrink-0 items-center gap-2 sm:order-last"
    >
      <HeaderIdentity />
    </div>

    <div data-header-slot="tabs" class="basis-full sm:basis-auto">
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
    </div>
  </header>
</template>
