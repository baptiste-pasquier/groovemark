<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Filter } from 'lucide-vue-next'
import HeaderBar from '../layout/HeaderBar.vue'
import SortToggleButton from '../layout/SortToggleButton.vue'
import FavoritesGrid from './FavoritesGrid.vue'
import FavoriteSearchBar from './FavoriteSearchBar.vue'
import AddFavoriteButton from './AddFavoriteButton.vue'
import FavoriteModal from '../modals/FavoriteModal.vue'
import ArtistSidebar from '../filters/ArtistSidebar.vue'
import ArtistList from '../filters/ArtistList.vue'
import { useFavoritesStore } from '../../stores/favorites'
import { useFavoritesUiStore } from '../../stores/favoritesUi'

// The grid, the favorite modal and the artist sidebar stay under one parent:
// a route outlet does not forward a child's emits, so the modal's open state
// lives here, one level above the grid, exactly as it did in App.vue.
const showModal = ref(false)
const editId = ref<string | null>(null)
const showSidebar = ref(false)

const favoritesStore = useFavoritesStore()
const favoritesUiStore = useFavoritesUiStore()

const { t } = useI18n()

function addFavorite() {
  editId.value = null
  showModal.value = true
}

function editFavorite(id: string) {
  editId.value = id
  showModal.value = true
}
</script>

<template>
  <HeaderBar />

  <div class="mixes-body">
    <div class="view-controls">
      <div class="view-controls-search">
        <FavoriteSearchBar />
        <SortToggleButton
          button-id="sort-btn"
          :order="favoritesUiStore.sortOrder"
          @toggle="favoritesUiStore.toggleSort()"
        />
        <button
          id="filter-menu-btn"
          type="button"
          class="view-control-button favorites-desktop-hidden"
          :title="t('app.filter_by_artist')"
          @click="showSidebar = true"
        >
          <Filter class="h-5 w-5 text-gray-700" />
        </button>
      </div>
      <div class="view-controls-action">
        <AddFavoriteButton :disabled="favoritesStore.isReadOnly" @click="addFavorite" />
      </div>
    </div>

    <div class="favorites-layout">
      <aside class="favorites-sidebar-desktop">
        <div class="flex flex-1 flex-col overflow-hidden">
          <h3 class="mb-3 text-xs font-bold tracking-wider text-gray-500 uppercase">
            {{ t('app.artists') }}
          </h3>
          <ArtistList class="flex-1 overflow-y-auto" />
        </div>
      </aside>

      <main class="favorites-main">
        <FavoritesGrid @edit="editFavorite" />
      </main>
    </div>
  </div>

  <FavoriteModal v-model="showModal" :edit-id="editId" />
  <ArtistSidebar :open="showSidebar" @close="showSidebar = false" />
</template>
