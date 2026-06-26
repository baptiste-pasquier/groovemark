<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useFavoritesStore } from '../../stores/favorites'
import { useFavoritesUiStore } from '../../stores/favoritesUi'
import { useI18n } from 'vue-i18n'
import FavoriteCard from './FavoriteCard.vue'

const BATCH_SIZE = 20

const favoritesStore = useFavoritesStore()
const favoritesUiStore = useFavoritesUiStore()
const { t } = useI18n()

const emit = defineEmits<{ (e: 'edit', id: string): void }>()

const displayCount = ref(BATCH_SIZE)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const visibleFavorites = computed(() =>
  favoritesUiStore.filteredFavorites.slice(0, displayCount.value),
)

const hasMore = computed(() => displayCount.value < favoritesUiStore.filteredFavorites.length)

watch(
  () => favoritesUiStore.filteredFavorites,
  () => {
    displayCount.value = BATCH_SIZE
  },
)

function loadMore() {
  if (hasMore.value) {
    displayCount.value += BATCH_SIZE
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    },
    { rootMargin: '200px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
})

watch(sentinel, (el) => {
  observer?.disconnect()
  if (el) observer?.observe(el)
})
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
        v-for="fav in visibleFavorites"
        :key="fav.id"
        :favorite="fav"
        @edit="emit('edit', fav.id)"
        @delete="favoritesStore.deleteFavorite(fav.id)"
      />
    </div>
    <div v-if="hasMore" ref="sentinel" class="h-1" />
  </div>
</template>
