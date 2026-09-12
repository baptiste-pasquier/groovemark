<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { CalendarArrowDown, CalendarArrowUp } from 'lucide-vue-next'

// The one date-reversal control, shared by the mixes and events destinations.
// The caller passes the order it holds and reacts to the toggle, so this
// button reads no store and neither destination can grow a second wording for
// the same gesture. The id is a prop because each destination keeps its own,
// which is what the unit specs address it by.
defineProps<{ order: 'newest' | 'oldest'; buttonId: string }>()
defineEmits<{ (e: 'toggle'): void }>()

const { t } = useI18n()
</script>

<template>
  <button
    :id="buttonId"
    type="button"
    class="shrink-0 rounded-lg border border-gray-300 bg-white p-2 shadow-sm transition duration-300 hover:bg-gray-200 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:outline-none"
    :title="
      order === 'newest' ? t('app.sort_toggle_title_oldest') : t('app.sort_toggle_title_newest')
    "
    @click="$emit('toggle')"
  >
    <component
      :is="order === 'newest' ? CalendarArrowDown : CalendarArrowUp"
      class="h-5 w-5 text-gray-700"
    />
  </button>
</template>
