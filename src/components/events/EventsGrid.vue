<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import HeaderBar from '../layout/HeaderBar.vue'
import EventCard from './EventCard.vue'
import EventsSearchBar from './EventsSearchBar.vue'
import { useEventsStore } from '../../stores/events'
import { useEventsUiStore } from '../../stores/eventsUi'

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

function openEvent(id: string) {
  openEventId.value = id
}

defineExpose({ openEventId })
</script>

<template>
  <HeaderBar />

  <main>
    <div class="mb-6">
      <EventsSearchBar />
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
        @open="openEvent"
      />
    </div>
  </main>
</template>
