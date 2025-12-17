<script setup lang="ts">
import { useFavoritesStore } from '../../stores/favorites'
import { AlertCircle, Info } from 'lucide-vue-next'

const store = useFavoritesStore()
</script>

<template>
  <Transition name="dialog-fade">
    <div
      v-if="store.alertDialog.visible"
      class="modal-bg fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="dialog-panel mx-auto w-11/12 max-w-sm transform overflow-hidden rounded-xl bg-white p-6 text-center shadow-2xl"
        @click.stop
      >
        <div
          class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          :class="store.alertDialog.type === 'alert' ? 'bg-red-100' : 'bg-blue-100'"
        >
          <AlertCircle v-if="store.alertDialog.type === 'alert'" class="h-6 w-6 text-red-600" />
          <Info v-else class="h-6 w-6 text-blue-600" />
        </div>
        <h3 class="mb-2 text-lg leading-6 font-medium text-gray-900">
          {{ store.alertDialog.type === 'alert' ? $t('dialog.alert') : $t('dialog.info') }}
        </h3>
        <p class="mb-6 text-sm text-gray-500">{{ store.alertDialog.message }}</p>
        <button
          class="inline-flex w-full justify-center rounded-lg px-4 py-2 text-base font-medium text-white shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none sm:text-sm"
          :class="
            store.alertDialog.type === 'alert'
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
          "
          @click="store.closeAlert()"
        >
          {{ $t('dialog.ok') }}
        </button>
      </div>
    </div>
  </Transition>
</template>
