<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
const store = useFavoritesStore()
</script>
<template>
  <div
    v-if="store.confirmDialog.visible"
    class="modal-bg fixed inset-0 z-50 flex items-center justify-center"
  >
    <div class="mx-auto w-11/12 max-w-sm rounded-lg bg-white p-6 shadow-xl">
      <p class="mb-6 text-gray-800">{{ store.confirmDialog.message }}</p>
      <div class="flex justify-end space-x-2">
        <button
          class="rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300"
          @click="store.respondConfirm(false)"
        >
          Annuler
        </button>
        <button
          class="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          @click="store.respondConfirm(true)"
        >
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>
