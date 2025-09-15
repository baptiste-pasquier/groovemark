<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
const store = useFavoritesStore()
</script>
<template>
  <div
    v-if="store.alertDialog.visible"
    class="fixed inset-0 z-50 flex items-center justify-center modal-bg"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-sm mx-auto text-center">
      <p class="text-gray-800 mb-4">{{ store.alertDialog.message }}</p>
      <button
        class="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        @click="store.closeAlert()"
      >
        OK
      </button>
    </div>
  </div>
</template>
