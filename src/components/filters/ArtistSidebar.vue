<script setup lang="ts">
import { computed } from 'vue'
import ArtistList from './ArtistList.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const isOpen = computed({
  get: () => props.open,
  set: (value) => {
    if (!value) {
      emit('close')
    }
  },
})
</script>

<template>
  <USlideover v-model:open="isOpen" title="Filtrer par artiste">
    <template #content>
      <div class="p-4">
        <ArtistList @select="emit('close')" />
      </div>
    </template>
  </USlideover>
</template>
