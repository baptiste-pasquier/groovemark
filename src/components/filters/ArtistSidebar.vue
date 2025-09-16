<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
const store = useFavoritesStore()

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

function setFilter(a: string) {
  store.setFilter(a)
  emit('close')
}
</script>
<template>
  <!-- Overlay -->
  <div v-if="open" class="fixed inset-0 z-40 bg-black/50" @click="emit('close')" />
  <!-- Sidebar panel -->
  <div
    class="sidebar fixed top-0 right-0 z-50 flex h-full w-64 transform flex-col bg-white shadow-lg"
    :class="open ? 'translate-x-0' : 'pointer-events-none translate-x-full'"
    :aria-hidden="!open"
  >
    <div class="flex h-full flex-col p-4">
      <div class="mb-4 flex shrink-0 items-center justify-between">
        <h3 class="text-xl font-bold">Filtrer par artiste</h3>
        <button class="p-1 text-2xl leading-none" @click="emit('close')">&times;</button>
      </div>
      <ul class="grow space-y-2 overflow-y-auto">
        <li>
          <a
            href="#"
            class="block rounded-md px-4 py-2"
            :class="
              store.currentFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            "
            @click.prevent="setFilter('all')"
            >Tous les artistes</a
          >
        </li>
        <li v-for="artist in store.allArtists" :key="artist">
          <a
            href="#"
            class="block rounded-md px-4 py-2"
            :class="
              store.currentFilter === artist ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
            "
            @click.prevent="setFilter(artist)"
            >{{ artist }}</a
          >
        </li>
      </ul>
    </div>
  </div>
</template>
