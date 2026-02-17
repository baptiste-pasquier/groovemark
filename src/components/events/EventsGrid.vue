<script setup lang="ts">
import { useEventsStore } from '../../stores/events'
import EventCard from './EventCard.vue'
import { useI18n } from 'vue-i18n'

const store = useEventsStore()
const { t } = useI18n()

const emit = defineEmits<{ (e: 'edit', id: string): void }>()
</script>

<template>
  <div v-if="store.isLoading" class="py-12 text-center text-gray-500">
    {{ t('modal.loading') }}
  </div>
  <div v-else-if="store.filteredEvents.length === 0" class="py-12 text-center text-gray-500">
    <p v-if="store.events.length === 0">{{ t('events.empty_no_events') }}</p>
    <p v-else>{{ t('events.empty_no_results') }}</p>
  </div>
  <TransitionGroup
    v-else
    name="card"
    tag="div"
    class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
  >
    <EventCard
      v-for="event in store.filteredEvents"
      :key="event.id"
      :event="event"
      @edit="emit('edit', $event)"
      @delete="store.deleteEvent($event)"
    />
  </TransitionGroup>
</template>

<style scoped>
.card-enter-active,
.card-leave-active {
  transition: all 0.3s ease;
}

.card-enter-from,
.card-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
