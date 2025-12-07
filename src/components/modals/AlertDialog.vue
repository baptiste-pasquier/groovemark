<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
const store = useFavoritesStore()
</script>
<template>
  <div
    v-if="store.alertDialog.visible"
    class="modal-bg fixed inset-0 z-50 flex items-center justify-center"
  >
    <div class="mx-auto w-11/12 max-w-sm rounded-lg bg-white p-6 text-center shadow-xl">
      <p class="mb-4 text-gray-800">{{ store.alertDialog.message }}</p>
      <button
        class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none"
        @click="store.closeAlert()"
      >
        OK
      </button>
    </div>
  </div>
</template>
