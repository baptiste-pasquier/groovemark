<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import { useFavoritesUiStore } from '../../stores/favoritesUi'
import { useI18n } from 'vue-i18n'
import FavoriteCard from './FavoriteCard.vue'

const favoritesStore = useFavoritesStore()
const favoritesUiStore = useFavoritesUiStore()
const { t } = useI18n()

const emit = defineEmits<{ (e: 'edit', id: string): void }>()
</script>

<template>
  <div>
    <div v-if="!favoritesUiStore.filteredFavorites.length" class="mt-8 text-center text-gray-500">
      {{
        favoritesStore.favorites.length === 0
          ? t('grid.empty_no_favorites')
          : t('grid.empty_no_results')
      }}
    </div>
    <div
      v-else
      id="favorites-grid"
      class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <FavoriteCard
        v-for="fav in favoritesUiStore.filteredFavorites"
        :key="fav.id"
        :favorite="fav"
        @edit="emit('edit', fav.id)"
        @delete="favoritesStore.deleteFavorite(fav.id)"
      />
    </div>
  </div>
</template>
