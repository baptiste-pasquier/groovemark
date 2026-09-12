<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import { useFavoritesUiStore } from '../../stores/favoritesUi'

const favoritesUiStore = useFavoritesUiStore()

// Creates a debounced version of the function
const onSearch = useDebounceFn((e: Event) => {
  const value = (e.target as HTMLInputElement).value
  favoritesUiStore.setSearch(value)
}, 300)
</script>

<template>
  <div class="view-search">
    <input
      id="favorites-search"
      type="text"
      :placeholder="$t('app.search_placeholder')"
      class="view-search-input"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <Search class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
