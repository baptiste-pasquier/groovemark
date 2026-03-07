<script setup lang="ts">
import { useFavoritesUiStore } from '../../stores/favoritesUi'
import { AlertTriangle } from 'lucide-vue-next'

const favoritesUiStore = useFavoritesUiStore()
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="favoritesUiStore.confirmDialog.visible"
      class="modal-bg fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="dialog-panel mx-auto w-11/12 max-w-sm transform overflow-hidden rounded-xl bg-white p-6 text-center shadow-2xl"
        @click.stop
      >
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100"
        >
          <AlertTriangle class="h-6 w-6 text-red-600" />
        </div>
        <h3 class="mb-2 text-lg leading-6 font-medium text-gray-900">
          {{ $t('dialog.confirmation') }}
        </h3>
        <p class="mb-6 text-sm text-gray-500">{{ favoritesUiStore.confirmDialog.message }}</p>
        <div class="flex justify-end space-x-3">
          <button
            class="inline-flex w-full justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
            @click="favoritesUiStore.respondConfirm(false)"
          >
            {{ $t('dialog.cancel') }}
          </button>
          <button
            class="inline-flex w-full justify-center rounded-lg bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none sm:w-auto sm:text-sm"
            @click="favoritesUiStore.respondConfirm(true)"
          >
            {{ $t('dialog.delete') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
