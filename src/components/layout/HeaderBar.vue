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
  <header class="mb-8 flex flex-col sm:flex-row justify-between items-center">
    <div>
      <h1 class="text-4xl font-bold text-gray-900">MixStash</h1>
      <p class="text-gray-600">Enregistrez vos sets favoris avec des timestamps précis.</p>
    </div>
    <div class="mt-4 sm:mt-0 flex items-center space-x-2">
      <button
        id="sort-btn"
        class="p-2 rounded-lg bg-white hover:bg-gray-200 transition duration-300 shadow-sm border border-gray-300"
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
        class="p-2 rounded-lg bg-white hover:bg-gray-200 transition duration-300 shadow-sm border border-gray-300"
        @click="openFilters"
      >
        <FilterIcon class="h-6 w-6 text-gray-700" />
      </button>
      <label
        for="import-json"
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 shadow-sm whitespace-nowrap"
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
        class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 shadow-sm whitespace-nowrap"
        @click="store.exportFavorites()"
      >
        Exporter JSON
      </button>
    </div>
  </header>
  <div class="mb-6 relative">
    <input
      type="text"
      id="search-input"
      placeholder="Rechercher par titre ou artiste..."
      class="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 transition-colors"
      @input="onSearch"
    />
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <SearchIcon class="h-5 w-5 text-gray-400" />
    </div>
  </div>
  <div class="mb-8">
    <button
      id="add-favorite-btn"
      class="w-full bg-white text-blue-500 font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-blue-50 transition duration-300 border-2 border-dashed border-gray-300 hover:border-blue-400"
      @click="emit('add')"
    >
      + Ajouter un nouveau favori
    </button>
  </div>
</template>

<script lang="ts">
export default {}
</script>
