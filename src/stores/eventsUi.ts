import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { MusicEvent } from '../types/event'
import { useEventsStore } from './events'

export const useEventsUiStore = defineStore('eventsUi', () => {
  // The events tab's own search box, and nothing else's. Three independent
  // search boxes now exist, so sharing the ref that filters the mixes grid
  // would let typing in one tab silently narrow another (KTD7).
  const searchTerm = ref('')

  const eventsStore = useEventsStore()

  // Filters, never orders. The date ordering belongs to the domain store
  // (R11), so the filter sits on top of it: clearing the box hands back the
  // full date-ordered list untouched (AE18). Both the event name and the venue
  // are searched, because a night is remembered by either (R27).
  const filteredEvents = computed<MusicEvent[]>(() => {
    const normalizedSearchTerm = searchTerm.value.toLowerCase().trim()
    if (!normalizedSearchTerm) return eventsStore.events

    return eventsStore.events.filter(
      (event) =>
        event.name.toLowerCase().includes(normalizedSearchTerm) ||
        event.venue.toLowerCase().includes(normalizedSearchTerm),
    )
  })

  function setSearch(term: string) {
    searchTerm.value = term
  }

  function $reset() {
    searchTerm.value = ''
  }

  return {
    searchTerm,
    filteredEvents,
    setSearch,
    $reset,
  }
})
