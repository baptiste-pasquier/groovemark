<script setup lang="ts">
import SearchIcon from '../icons/SearchIcon.vue'
import { useFavoritesStore } from '../../stores/favorites'

const store = useFavoritesStore()

function onSearch(e: Event) {
  store.setSearch((e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="relative">
    <input
      type="text"
      :placeholder="$t('app.search_placeholder')"
      class="w-full rounded-lg border border-gray-200 bg-white p-3 pl-10 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <SearchIcon class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
