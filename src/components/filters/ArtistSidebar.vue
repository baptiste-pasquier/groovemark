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
  <div v-if="open" class="fixed inset-0 bg-black/50 z-40" @click="emit('close')" />
  <!-- Sidebar panel -->
  <div
    class="fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform sidebar flex flex-col"
    :class="open ? 'translate-x-0' : 'translate-x-full pointer-events-none'"
    :aria-hidden="!open"
  >
    <div class="p-4 flex flex-col h-full">
      <div class="flex justify-between items-center mb-4 shrink-0">
        <h3 class="text-xl font-bold">Filtrer par artiste</h3>
        <button class="p-1 text-2xl leading-none" @click="emit('close')">&times;</button>
      </div>
      <ul class="space-y-2 grow overflow-y-auto">
        <li>
          <a
            href="#"
            class="block px-4 py-2 rounded-md"
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
            class="block px-4 py-2 rounded-md"
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
