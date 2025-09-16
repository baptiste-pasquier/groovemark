<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import SortIconNewest from '../icons/SortIconNewest.vue'
import SortIconOldest from '../icons/SortIconOldest.vue'
import FilterIcon from '../icons/FilterIcon.vue'
import SearchIcon from '../icons/SearchIcon.vue'

const store = useFavoritesStore()

const emit = defineEmits<{
  (e: 'openFilters'): void
  (e: 'importClick', evt: Event): void
  (e: 'add'): void
}>()

function onSearch(e: Event) {
  store.setSearch((e.target as HTMLInputElement).value)
}

function toggleSort() {
  store.toggleSort()
}

function openFilters() {
  emit('openFilters')
}
</script>

<template>
  <header class="mb-8 flex flex-col items-center justify-between sm:flex-row">
    <div>
      <h1 class="text-4xl font-bold text-gray-900">MixStash</h1>
      <p class="text-gray-600">Enregistrez vos sets favoris avec des timestamps précis.</p>
    </div>
    <div class="mt-4 flex items-center space-x-2 sm:mt-0">
      <button
        id="sort-btn"
        class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200"
        @click="toggleSort"
        :title="store.sortOrder === 'newest' ? 'Trier plus anciens' : 'Trier plus récents'"
      >
        <component
          :is="store.sortOrder === 'newest' ? SortIconNewest : SortIconOldest"
          class="h-6 w-6 text-gray-700"
        />
      </button>
      <button
        id="filter-menu-btn"
        class="rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200"
        @click="openFilters"
      >
        <FilterIcon class="h-6 w-6 text-gray-700" />
      </button>
      <label
        for="import-json"
        class="cursor-pointer rounded-lg bg-blue-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-blue-600"
      >
        Importer JSON
      </label>
      <input
        type="file"
        id="import-json"
        class="hidden"
        accept=".json"
        @change="(e) => emit('importClick', e)"
      />
      <button
        id="export-json-btn"
        class="rounded-lg bg-green-500 px-4 py-2 font-bold whitespace-nowrap text-white shadow-sm transition duration-300 hover:bg-green-600"
        @click="store.exportFavorites()"
      >
        Exporter JSON
      </button>
    </div>
  </header>
  <div class="relative mb-6">
    <input
      type="text"
      id="search-input"
      placeholder="Rechercher par titre ou artiste..."
      class="w-full rounded-lg border border-gray-300 p-3 pl-10 transition-colors focus:ring-2 focus:ring-blue-500"
      @input="onSearch"
    />
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <SearchIcon class="h-5 w-5 text-gray-400" />
    </div>
  </div>
  <div class="mb-8">
    <button
      id="add-favorite-btn"
      class="w-full rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 font-semibold text-blue-500 shadow-md transition duration-300 hover:border-blue-400 hover:bg-blue-50"
      @click="emit('add')"
    >
      + Ajouter un nouveau favori
    </button>
  </div>
</template>

<script lang="ts">
export default {}
</script>
