<script setup lang="ts">
import PlusIcon from '@/components/icons/PlusIcon.vue'

defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-md transition duration-300 hover:bg-blue-700 hover:shadow-lg focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none"
    @click="$emit('click')"
  >
    <PlusIcon />
    {{ $t('app.add_new') }}
  </button>
</template>
