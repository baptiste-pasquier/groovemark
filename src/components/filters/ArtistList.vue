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
      <a
        href="#"
        class="block rounded-md px-4 py-2 transition-colors"
        :class="store.currentFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'"
        @click.prevent="setFilter('all')"
      >
        {{ t('app.all_artists') }}
      </a>
    </li>
    <li v-for="artist in store.allArtists" :key="artist">
      <a
        href="#"
        class="block rounded-md px-4 py-2 transition-colors"
        :class="store.currentFilter === artist ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'"
        @click.prevent="setFilter(artist)"
      >
        {{ artist }}
      </a>
    </li>
  </ul>
</template>
