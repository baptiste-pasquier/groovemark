<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { useFavoritesStore } from '../../stores/favorites'

const store = useFavoritesStore()

// Creates a debounced version of the function
const onSearch = useDebounceFn((e: Event) => {
  const value = (e.target as HTMLInputElement).value
  store.setSearch(value)
}, 300)
</script>

<template>
  <UInput
    icon="i-lucide-search"
    size="lg"
    :placeholder="$t('app.search_placeholder')"
    @input="onSearch"
  />
</template>
