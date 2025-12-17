<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import { useI18n } from 'vue-i18n'
import FavoriteCard from './FavoriteCard.vue'

const store = useFavoritesStore()
const { t } = useI18n()

const emit = defineEmits<{ (e: 'edit', id: string): void }>()
</script>

<template>
  <div>
    <div v-if="!store.filteredFavorites.length" class="mt-8 text-center text-gray-500">
      {{ store.favorites.length === 0 ? t('grid.empty_no_favorites') : t('grid.empty_no_results') }}
    </div>
    <TransitionGroup
      v-else
      tag="div"
      name="list"
      id="favorites-grid"
      class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      <FavoriteCard
        v-for="fav in store.filteredFavorites"
        :key="fav.id"
        :favorite="fav"
        @edit="emit('edit', fav.id)"
        @delete="store.deleteFavorite(fav.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.list-leave-active {
  position: absolute;
}
</style>
