<script setup lang="ts">
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <UButton block size="lg" icon="i-lucide-plus" @click="$emit('click')">
    {{ $t('app.add_new') }}
  </UButton>
</template>
