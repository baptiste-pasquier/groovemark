<script setup lang="ts">
import { watch } from 'vue'
import { useFavoritesStore } from '../../stores/favorites'

const store = useFavoritesStore()
// @ts-expect-error - useToast is auto-imported by Nuxt UI
const toast = useToast()

// Watch for alert dialog changes and show toast instead
watch(
  () => store.alertDialog.visible,
  (visible) => {
    if (visible && store.alertDialog.message) {
      toast.add({
        title: store.alertDialog.message,
        color: 'error',
      })
      // Auto-close the alert in the store
      store.closeAlert()
    }
  },
)
</script>

<template>
  <!-- No UI needed - using toast notifications -->
  <div v-if="false" />
</template>
