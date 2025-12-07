<script setup lang="ts">
import { Button } from '@/components/ui/button'
import PlusIcon from '@/components/icons/PlusIcon.vue'

defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <Button
    type="button"
    class="w-full gap-2"
    @click="$emit('click')"
  >
    <PlusIcon />
    {{ $t('app.add_new') }}
  </Button>
</template>
