<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import SearchIcon from '../icons/SearchIcon.vue'
import { Input } from '@/components/ui/input'
import { useFavoritesStore } from '../../stores/favorites'

const store = useFavoritesStore()

// Creates a debounced version of the function
const onSearch = useDebounceFn((e: Event) => {
  const value = (e.target as HTMLInputElement).value
  store.setSearch(value)
}, 300)
</script>

<template>
  <div class="relative">
    <Input
      type="text"
      :placeholder="$t('app.search_placeholder')"
      class="pl-10"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <SearchIcon class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
