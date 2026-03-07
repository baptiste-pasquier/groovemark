<script setup lang="ts">
import ArtistList from './ArtistList.vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
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
        <h3 class="text-xl font-bold">{{ $t('app.filter_by_artist') }}</h3>
        <button class="p-1 text-2xl leading-none" @click="emit('close')">&times;</button>
      </div>
      <ArtistList class="grow" @select="emit('close')" />
    </div>
  </div>
</template>
