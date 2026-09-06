<script setup lang="ts">
import { CirclePlus } from 'lucide-vue-next'

defineProps<{ disabled?: boolean }>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    type="button"
    class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-md transition duration-300 hover:bg-blue-700 hover:shadow-lg focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:hover:bg-gray-300"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <CirclePlus class="h-5 w-5" />
    {{ $t('app.add_new') }}
  </button>
</template>
