<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFavoritesStore } from '../../stores/favorites'

const { t } = useI18n()
const store = useFavoritesStore()

const emit = defineEmits<{ (e: 'select'): void }>()

function setFilter(a: string) {
  store.setFilter(a)
  emit('select')
}
</script>

<template>
  <ul class="space-y-2 overflow-y-auto">
    <li>
      <button
        type="button"
        class="mb-2 block w-full rounded-md border-b border-gray-200 px-4 py-2 text-left font-bold transition-colors"
        :class="store.currentFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'"
        @click="setFilter('all')"
      >
        {{ t('app.all_artists') }}
      </button>
    </li>
    <li v-for="artist in store.allArtists" :key="artist">
      <button
        type="button"
        class="block w-full rounded-md px-4 py-2 text-left transition-colors"
        :class="store.currentFilter === artist ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'"
        @click="setFilter(artist)"
      >
        {{ artist }}
      </button>
    </li>
  </ul>
</template>
