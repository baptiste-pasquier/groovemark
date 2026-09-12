<script setup lang="ts">
import { CirclePlus } from 'lucide-vue-next'

defineProps<{ disabled?: boolean }>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button type="button" class="view-control-action" :disabled="disabled" @click="$emit('click')">
    <CirclePlus class="h-5 w-5" />
    {{ $t('app.add_new') }}
  </button>
</template>
