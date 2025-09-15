<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import FavoriteCard from './FavoriteCard.vue'

const store = useFavoritesStore()

const emit = defineEmits<{ (e: 'edit', id: string): void }>()
</script>

<template>
  <div>
    <div v-if="!store.filteredFavorites.length" class="text-center text-gray-500 mt-8">
      {{
        store.favorites.length === 0
          ? "Vous n'avez aucun favori pour le moment. Ajoutez-en un pour commencer !"
          : 'Aucun favori ne correspond à vos critères de recherche.'
      }}
    </div>
    <div
      v-else
      id="favorites-grid"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <FavoriteCard
        v-for="fav in store.filteredFavorites"
        :key="fav.id"
        :favorite="fav"
        @edit="emit('edit', fav.id)"
        @delete="store.deleteFavorite(fav.id)"
      />
    </div>
  </div>
</template>
