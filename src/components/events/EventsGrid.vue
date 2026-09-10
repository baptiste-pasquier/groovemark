<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import HeaderBar from '../layout/HeaderBar.vue'
import EventModal from '../modals/EventModal.vue'
import AddEventButton from './AddEventButton.vue'
import EventCard from './EventCard.vue'
import EventsSearchBar from './EventsSearchBar.vue'
import { useAppStore } from '../../stores/app'
import { useEventsStore } from '../../stores/events'
import { useEventsUiStore } from '../../stores/eventsUi'

const appStore = useAppStore()
const eventsStore = useEventsStore()
const eventsUiStore = useEventsUiStore()
const { t } = useI18n()

// The event currently under revision. An existing event is reopened from its
// own card, on the surface that created it (R8, AE17): the card names it, this
// view remembers which one, and the editing surface mounts here bound to this
// ref. It lives here rather than being emitted upward because a route outlet
// does not forward a child's emits -- the same reason the mixes modal's open
// state sits in MixesView. Exposed so the editing surface, or a test, can read
// it without this view having to be restructured.
const openEventId = ref<string | null>(null)
const showEventModal = ref(false)

function openEvent(id: string) {
  openEventId.value = id
  showEventModal.value = true
}

// A new event is the same surface with nothing under revision, so one modal
// serves both and no second creation surface exists (R8).
function createEvent() {
  openEventId.value = null
  showEventModal.value = true
}

// Closing the surface releases the event it held, so the next open starts
// from what it was actually given rather than from the last revision.
watch(showEventModal, (open) => {
  if (!open) openEventId.value = null
})

defineExpose({ openEventId, showEventModal })
</script>

<template>
  <HeaderBar />

  <main>
    <div class="mb-6 flex flex-col gap-4 md:flex-row md:items-center">
      <div class="min-w-0 flex-1">
        <EventsSearchBar />
      </div>
      <div class="md:w-56">
        <AddEventButton :disabled="appStore.isReadOnly" @click="createEvent" />
      </div>
    </div>

    <div v-if="!eventsUiStore.filteredEvents.length" class="mt-8 text-center text-gray-500">
      {{
        eventsStore.events.length === 0 ? t('events.empty_no_events') : t('events.empty_no_results')
      }}
    </div>
    <!-- Every event renders in one pass: no batch counter, no observer
         sentinel. The mixes grid's progressive rendering answers a card count
         an events list does not reach, so a plain iteration is the right shape
         here -- see docs/reference/responsive-layout.md. -->
    <div v-else id="events-grid" class="card-grid">
      <EventCard
        v-for="event in eventsUiStore.filteredEvents"
        :key="event.id"
        :event="event"
        :read-only="appStore.isReadOnly"
        @open="openEvent"
        @delete="eventsStore.deleteEvent(event.id)"
      />
    </div>
  </main>

  <EventModal v-model="showEventModal" :edit-id="openEventId" />
</template>
