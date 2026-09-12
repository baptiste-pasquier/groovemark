<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import { useEventsUiStore } from '../../stores/eventsUi'

const eventsUiStore = useEventsUiStore()

// Uncontrolled and debounced, exactly as the mixes search is: the input owns
// what is typed, and the store hears about it once the typing settles.
const onSearch = useDebounceFn((e: Event) => {
  const value = (e.target as HTMLInputElement).value
  eventsUiStore.setSearch(value)
}, 300)
</script>

<template>
  <div class="view-search">
    <input
      id="events-search"
      type="text"
      :placeholder="$t('events.search_placeholder')"
      class="view-search-input"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <Search class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
