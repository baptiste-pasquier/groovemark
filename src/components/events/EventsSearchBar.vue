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
  <div class="relative">
    <input
      id="events-search"
      type="text"
      :placeholder="$t('events.search_placeholder')"
      class="w-full rounded-lg border border-gray-200 bg-white p-3 pl-10 shadow-sm transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <Search class="h-5 w-5 text-gray-400" />
    </div>
  </div>
</template>
