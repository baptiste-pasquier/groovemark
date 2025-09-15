<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
const store = useFavoritesStore()
</script>
<template>
  <div
    v-if="store.confirmDialog.visible"
    class="fixed inset-0 z-50 flex items-center justify-center modal-bg"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 w-11/12 max-w-sm mx-auto">
      <p class="text-gray-800 mb-6">{{ store.confirmDialog.message }}</p>
      <div class="flex justify-end space-x-2">
        <button
          class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          @click="store.respondConfirm(false)"
        >
          Annuler
        </button>
        <button
          class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          @click="store.respondConfirm(true)"
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>
