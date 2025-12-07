<script setup lang="ts">
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    class="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-md transition duration-300 hover:bg-blue-700 hover:shadow-lg"
    @click="$emit('click')"
  >
    {{ $t('app.add_new') }}
  </button>
</template>
