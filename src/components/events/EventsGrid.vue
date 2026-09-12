<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert } from 'lucide-vue-next'
import HeaderBar from '../layout/HeaderBar.vue'
import SortToggleButton from '../layout/SortToggleButton.vue'
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
    <!-- A failed load leaves the list empty because it is unknown, not because
         nothing was ever recorded, and the tab cannot say the second. The
         controls go with the list: a degraded session is read-only everywhere,
         so the add button would sit greyed out with nothing on screen saying
         why, and the search would filter a list that is not there. Same shape
         the artists catalogue takes when its own load fails. -->
    <div
      v-if="eventsStore.loadFailed"
      class="events-unavailable flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"
    >
      <TriangleAlert class="mt-0.5 h-5 w-5 shrink-0" />
      <p>{{ t('events.unavailable') }}</p>
    </div>

    <template v-else>
      <div class="view-controls mb-6">
        <div class="view-controls-search">
          <EventsSearchBar />
          <SortToggleButton
            button-id="events-sort-btn"
            :order="eventsUiStore.sortOrder"
            @toggle="eventsUiStore.toggleSort()"
          />
        </div>
        <div class="view-controls-action">
          <AddEventButton :disabled="appStore.isReadOnly" @click="createEvent" />
        </div>
      </div>

      <div v-if="!eventsUiStore.filteredEvents.length" class="mt-8 text-center text-gray-500">
        {{
          eventsStore.events.length === 0
            ? t('events.empty_no_events')
            : t('events.empty_no_results')
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
    </template>
  </main>

  <EventModal v-model="showEventModal" :edit-id="openEventId" />
</template>
