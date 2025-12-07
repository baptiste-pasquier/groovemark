<script setup lang="ts">
import { watch } from 'vue'
import { useFavoritesStore } from '../../stores/favorites'

const store = useFavoritesStore()
// useToast is auto-imported by Nuxt UI via unplugin-auto-import
// TypeScript recognition in vue-tsc is inconsistent, so we suppress the error
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
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
  <!-- This component uses toast notifications instead of a modal -->
  <!-- The template requires at least one element, but this component has no UI -->
  <!-- eslint-disable-next-line vue/valid-template-root -->
  <template />
</template>
