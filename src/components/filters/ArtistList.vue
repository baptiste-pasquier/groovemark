<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFavoritesStore } from '../../stores/favorites'
import { useFavoritesUiStore } from '../../stores/favoritesUi'

const { t } = useI18n()
const favoritesStore = useFavoritesStore()
const favoritesUiStore = useFavoritesUiStore()

const emit = defineEmits<{ (e: 'select'): void }>()

// `a` is an artist id, or the 'all' sentinel.
function setFilter(a: string) {
  favoritesUiStore.setFilter(a)
  emit('select')
}
</script>

<template>
  <ul class="space-y-2 overflow-y-auto">
    <li>
      <button
        type="button"
        class="mb-2 flex w-full items-center justify-between rounded-md border-b border-gray-200 px-4 py-2 text-left font-bold transition-colors"
        :class="
          favoritesUiStore.currentFilter === 'all'
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-100'
        "
        @click="setFilter('all')"
      >
        <span>{{ t('app.all_artists') }} ({{ favoritesUiStore.referencedArtists.length }})</span>
        <span
          class="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-normal text-gray-500"
          :class="{ 'bg-blue-100 text-blue-700': favoritesUiStore.currentFilter === 'all' }"
        >
          {{ favoritesStore.favorites.length }}
        </span>
      </button>
    </li>
    <li v-for="artist in favoritesUiStore.referencedArtists" :key="artist.id">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-md px-4 py-2 text-left transition-colors"
        :class="
          favoritesUiStore.currentFilter === artist.id
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-100'
        "
        @click="setFilter(artist.id)"
      >
        <span class="truncate">{{ artist.displayName }}</span>
        <span
          class="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-normal text-gray-500"
          :class="{ 'bg-blue-100 text-blue-700': favoritesUiStore.currentFilter === artist.id }"
        >
          {{ favoritesUiStore.mixAggregateFor(artist.id).mixCount }}
        </span>
      </button>
    </li>
  </ul>
</template>
