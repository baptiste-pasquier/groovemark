<script setup lang="ts">
import { computed } from 'vue'
import { useFavoritesStore } from '../../stores/favorites'
import { useI18n } from 'vue-i18n'

const store = useFavoritesStore()
const { t } = useI18n()

const isOpen = computed({
  get: () => store.confirmDialog.visible,
  set: (value) => {
    if (!value) {
      store.respondConfirm(false)
    }
  },
})
</script>

<template>
  <UModal v-model:open="isOpen" :title="t('app.confirm')">
    <template #content>
      <div class="p-4">
        <p class="text-gray-800">{{ store.confirmDialog.message }}</p>
      </div>
    </template>
    <template #footer="{ close }">
      <div class="flex justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="
            () => {
              store.respondConfirm(false)
              close()
            }
          "
        >
          {{ t('app.cancel') }}
        </UButton>
        <UButton
          color="error"
          @click="
            () => {
              store.respondConfirm(true)
              close()
            }
          "
        >
          {{ t('app.delete') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
