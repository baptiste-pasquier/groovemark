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
    class="view-control-action"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <CirclePlus class="h-5 w-5" />
    {{ $t('events.add_new') }}
  </button>
</template>
