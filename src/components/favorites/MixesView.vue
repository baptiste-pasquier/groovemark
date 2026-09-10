<script setup lang="ts">
import { ref } from 'vue'
import HeaderBar from '../layout/HeaderBar.vue'
import FavoritesGrid from './FavoritesGrid.vue'
import FavoriteSearchBar from './FavoriteSearchBar.vue'
import AddFavoriteButton from './AddFavoriteButton.vue'
import FavoriteModal from '../modals/FavoriteModal.vue'
import ArtistSidebar from '../filters/ArtistSidebar.vue'
import ArtistList from '../filters/ArtistList.vue'
import { useFavoritesStore } from '../../stores/favorites'

// The grid, the favorite modal and the artist sidebar stay under one parent:
// a route outlet does not forward a child's emits, so the modal's open state
// lives here, one level above the grid, exactly as it did in App.vue.
const showModal = ref(false)
const editId = ref<string | null>(null)
const showSidebar = ref(false)

const favoritesStore = useFavoritesStore()

function addFavorite() {
  editId.value = null
  showModal.value = true
}

function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    await favoritesStore.importFromFile(file)
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <HeaderBar @openFilters="showSidebar = true" @importClick="$event && handleImport($event)" />

  <div class="favorites-layout">
    <aside class="favorites-sidebar-desktop">
      <FavoriteSearchBar />
      <AddFavoriteButton :disabled="favoritesStore.isReadOnly" @click="addFavorite" />
      <div class="flex flex-1 flex-col overflow-hidden">
        <h3 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
          {{ $t('app.artists') }}
        </h3>
        <ArtistList class="flex-1 overflow-y-auto" />
      </div>
    </aside>

    <main class="favorites-main">
      <div class="favorites-mobile-controls">
        <FavoriteSearchBar />
        <AddFavoriteButton :disabled="favoritesStore.isReadOnly" @click="addFavorite" />
      </div>

      <FavoritesGrid @edit="editFavorite" />
    </main>
  </div>

  <FavoriteModal v-model="showModal" :edit-id="editId" />
  <ArtistSidebar :open="showSidebar" @close="showSidebar = false" />
</template>
