<script setup lang="ts">
import { CirclePlus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

defineEmits<{ (e: 'click'): void }>()
const { t } = useI18n()
</script>

<template>
  <button
    class="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 font-bold text-white shadow-sm transition duration-300 hover:bg-purple-700 focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:outline-none"
    @click="$emit('click')"
  >
    <CirclePlus class="h-5 w-5" />
    {{ t('events.add_new') }}
  </button>
</template>
