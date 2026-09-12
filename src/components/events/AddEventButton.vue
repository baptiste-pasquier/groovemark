<script setup lang="ts">
import { CirclePlus } from 'lucide-vue-next'

// The events tab's own trigger, shaped exactly like the mixes tab's: the
// caller passes the read-only state rather than this button reading it, so
// the one read-only switch stays in the app store (KTD6).
defineProps<{ disabled?: boolean }>()
defineEmits<{ (e: 'click'): void }>()
</script>

<template>
  <button
    id="add-event-btn"
    type="button"
    class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white shadow-md transition duration-300 hover:bg-blue-700 hover:shadow-lg focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:hover:bg-gray-300"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <CirclePlus class="h-5 w-5" />
    {{ $t('events.add_new') }}
  </button>
</template>
