<script setup lang="ts">
import { ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useEventsStore } from '../../stores/events'
import { Search } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const store = useEventsStore()
const { t } = useI18n()

const localSearch = ref(store.searchTerm)

const debouncedSearch = useDebounceFn((val: string) => {
  store.setSearch(val)
}, 300)

function onInput(e: globalThis.Event) {
  const value = (e.target as HTMLInputElement).value
  localSearch.value = value
  debouncedSearch(value)
}
</script>

<template>
  <div class="relative">
    <Search class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400" />
    <input
      type="text"
      :value="localSearch"
      @input="onInput"
      :placeholder="t('events.search_placeholder')"
      class="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 shadow-sm transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none"
    />
  </div>
</template>
